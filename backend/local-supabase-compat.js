import pg from 'pg';
import { promises as fs } from 'fs';
import { resolve, join, sep, dirname } from 'path';

const { Pool, types } = pg;

/*
 * PostgreSQL BIGINT and NUMERIC are strings by default in node-postgres.
 * CLONYFY uses BIGINT for millisecond expiries / audit ids and NUMERIC for
 * payment amounts. These values are inside JavaScript's safe range here.
 */
types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

let _pool = null;

function getPool() {
  if (_pool) return _pool;

  _pool = new Pool({
    host: process.env.LOCAL_DB_HOST || 'clonify-postgres',
    port: parseInt(process.env.LOCAL_DB_PORT || '5432', 10),
    user: process.env.LOCAL_DB_USER || 'clonyfy',
    password: process.env.LOCAL_DB_PASSWORD || '',
    database: process.env.LOCAL_DB_NAME || 'clonyfy',
    max: Math.max(
      2,
      Math.min(30, parseInt(process.env.LOCAL_DB_POOL_MAX || '15', 10) || 15),
    ),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    application_name: 'clonyfy-backend',
    ssl: process.env.LOCAL_DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  });

  _pool.on('error', (err) => {
    console.error('[local pg pool]', err?.message || err);
  });

  return _pool;
}

const PRIMARY_KEYS = {
  _clonyfy_migrations: ['name'],
  announcements: ['id'],
  audit_log: ['id'],
  clones: ['id'],
  contact_submissions: ['id'],
  errors: ['id'],
  payments: ['id'],
  promo_codes: ['code'],
  sessions: ['token'],
  settings: ['key'],
  shares: ['id'],
  usage_events: ['id'],
  users: ['id'],
};

function identifier(value) {
  const name = String(value || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return `"${name}"`;
}

function selectColumns(value = '*') {
  const raw = String(value || '*').trim();

  if (raw === '*') return '*';

  return raw
    .split(',')
    .map((part) => identifier(part.trim()))
    .join(', ');
}

function normalizeRows(payload) {
  const rows = Array.isArray(payload) ? payload : [payload];

  return rows
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row));
}

function errorResult(err) {
  return {
    data: null,
    error: {
      message: String(err?.message || err || 'Database error'),
      code: err?.code || '',
    },
  };
}

function parseOrExpression(expression) {
  const parts = String(expression || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.map((part) => {
    const match = part.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\.(ilike|eq|neq|gt|gte|lt|lte)\.(.*)$/s,
    );

    if (!match) {
      throw new Error(`Unsupported OR filter: ${part}`);
    }

    return {
      column: match[1],
      op: match[2],
      value: match[3],
    };
  });
}

class LocalQuery {
  constructor(table) {
    this.table = String(table);
    identifier(this.table);

    this.operation = 'select';
    this.columns = '*';
    this.payload = null;
    this.options = {};
    this.filters = [];
    this.orGroups = [];
    this.orders = [];
    this.limitValue = null;
    this.offsetValue = null;
    this.countMode = null;
    this.headOnly = false;
  }

  select(columns = '*', options = {}) {
    this.operation = 'select';
    this.columns = columns || '*';
    this.countMode = options?.count || null;
    this.headOnly = options?.head === true;
    return this;
  }

  insert(payload) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  upsert(payload, options = {}) {
    this.operation = 'upsert';
    this.payload = payload;
    this.options = options || {};
    return this;
  }

  update(payload) {
    this.operation = 'update';
    this.payload = payload || {};
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column, value) {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  gt(column, value) {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column, value) {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  in(column, values) {
    this.filters.push({
      column,
      op: 'in',
      value: Array.isArray(values) ? values : [],
    });
    return this;
  }

  or(expression) {
    this.orGroups.push(parseOrExpression(expression));
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orders.push({
      column,
      ascending: ascending !== false,
    });
    return this;
  }

  range(from, to) {
    const start = Math.max(0, Number(from) || 0);
    const end = Math.max(start, Number(to) || start);

    this.offsetValue = start;
    this.limitValue = end - start + 1;

    return this;
  }

  limit(value) {
    const n = Number(value);

    if (Number.isFinite(n) && n >= 0) {
      this.limitValue = Math.floor(n);
    }

    return this;
  }

  _pushCondition(parts, params, filter) {
    const col = identifier(filter.column);

    if (filter.op === 'eq' && filter.value === null) {
      parts.push(`${col} IS NULL`);
      return;
    }

    if (filter.op === 'neq' && filter.value === null) {
      parts.push(`${col} IS NOT NULL`);
      return;
    }

    if (filter.op === 'in') {
      const values = Array.isArray(filter.value) ? filter.value : [];

      if (!values.length) {
        parts.push('FALSE');
        return;
      }

      const placeholders = values.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });

      parts.push(`${col} IN (${placeholders.join(', ')})`);
      return;
    }

    const operators = {
      eq: '=',
      neq: '<>',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
      ilike: 'ILIKE',
    };

    const operator = operators[filter.op];

    if (!operator) {
      throw new Error(`Unsupported filter operator: ${filter.op}`);
    }

    params.push(filter.value);
    parts.push(`${col} ${operator} $${params.length}`);
  }

  _where(initialParams = []) {
    const params = [...initialParams];
    const parts = [];

    for (const filter of this.filters) {
      this._pushCondition(parts, params, filter);
    }

    for (const group of this.orGroups) {
      const groupParts = [];

      for (const filter of group) {
        this._pushCondition(groupParts, params, filter);
      }

      if (groupParts.length) {
        parts.push(`(${groupParts.join(' OR ')})`);
      }
    }

    return {
      sql: parts.length ? ` WHERE ${parts.join(' AND ')}` : '',
      params,
    };
  }

  async _select() {
    const pool = getPool();

    let count = null;

    if (this.countMode === 'exact') {
      const countWhere = this._where();

      const countResult = await pool.query(
        `SELECT COUNT(*)::bigint AS count FROM ${identifier(this.table)}${countWhere.sql}`,
        countWhere.params,
      );

      count = Number(countResult.rows?.[0]?.count || 0);
    }

    if (this.headOnly) {
      return {
        data: null,
        error: null,
        count: count ?? 0,
      };
    }

    const where = this._where();

    let sql =
      `SELECT ${selectColumns(this.columns)} ` +
      `FROM ${identifier(this.table)}${where.sql}`;

    if (this.orders.length) {
      sql +=
        ' ORDER BY ' +
        this.orders
          .map(
            (order) =>
              `${identifier(order.column)} ${order.ascending ? 'ASC' : 'DESC'}`,
          )
          .join(', ');
    }

    if (this.limitValue !== null) {
      sql += ` LIMIT ${Math.max(0, Math.floor(this.limitValue))}`;
    }

    if (this.offsetValue !== null) {
      sql += ` OFFSET ${Math.max(0, Math.floor(this.offsetValue))}`;
    }

    const result = await pool.query(sql, where.params);

    return {
      data: result.rows || [],
      error: null,
      count,
    };
  }

  async _insert(upsert = false) {
    const pool = getPool();
    const rows = normalizeRows(this.payload);

    if (!rows.length) {
      return { data: [], error: null };
    }

    const columns = [
      ...new Set(rows.flatMap((row) => Object.keys(row))),
    ];

    if (!columns.length) {
      return { data: [], error: null };
    }

    for (const column of columns) {
      identifier(column);
    }

    const params = [];

    const tuples = rows.map((row) => {
      const placeholders = columns.map((column) => {
        params.push(row[column] === undefined ? null : row[column]);
        return `$${params.length}`;
      });

      return `(${placeholders.join(', ')})`;
    });

    let sql =
      `INSERT INTO ${identifier(this.table)} ` +
      `(${columns.map(identifier).join(', ')}) ` +
      `VALUES ${tuples.join(', ')}`;

    if (upsert) {
      const configuredConflict = String(
        this.options?.onConflict || '',
      )
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      const conflictColumns =
        configuredConflict.length
          ? configuredConflict
          : PRIMARY_KEYS[this.table] || [];

      if (!conflictColumns.length) {
        throw new Error(
          `No conflict key configured for table ${this.table}`,
        );
      }

      const conflictSet = new Set(conflictColumns);

      const updateColumns = columns.filter(
        (column) => !conflictSet.has(column),
      );

      sql +=
        ` ON CONFLICT (${conflictColumns.map(identifier).join(', ')}) `;

      if (!updateColumns.length) {
        sql += 'DO NOTHING';
      } else {
        sql +=
          'DO UPDATE SET ' +
          updateColumns
            .map(
              (column) =>
                `${identifier(column)} = EXCLUDED.${identifier(column)}`,
            )
            .join(', ');
      }
    }

    sql += ' RETURNING *';

    const result = await pool.query(sql, params);

    return {
      data: result.rows || [],
      error: null,
    };
  }

  async _update() {
    const pool = getPool();

    const payload =
      this.payload && typeof this.payload === 'object'
        ? this.payload
        : {};

    const columns = Object.keys(payload);

    if (!columns.length) {
      return { data: [], error: null };
    }

    const params = [];

    const sets = columns.map((column) => {
      identifier(column);
      params.push(payload[column] === undefined ? null : payload[column]);
      return `${identifier(column)} = $${params.length}`;
    });

    const where = this._where(params);

    const sql =
      `UPDATE ${identifier(this.table)} ` +
      `SET ${sets.join(', ')}${where.sql} RETURNING *`;

    const result = await pool.query(sql, where.params);

    return {
      data: result.rows || [],
      error: null,
    };
  }

  async _delete() {
    const pool = getPool();
    const where = this._where();

    const result = await pool.query(
      `DELETE FROM ${identifier(this.table)}${where.sql} RETURNING *`,
      where.params,
    );

    return {
      data: result.rows || [],
      error: null,
    };
  }

  async _execute() {
    try {
      if (this.operation === 'select') {
        return await this._select();
      }

      if (this.operation === 'insert') {
        return await this._insert(false);
      }

      if (this.operation === 'upsert') {
        return await this._insert(true);
      }

      if (this.operation === 'update') {
        return await this._update();
      }

      if (this.operation === 'delete') {
        return await this._delete();
      }

      throw new Error(`Unsupported operation: ${this.operation}`);
    } catch (err) {
      return errorResult(err);
    }
  }

  async maybeSingle() {
    if (this.limitValue === null) {
      this.limitValue = 2;
    }

    const result = await this._execute();

    if (result.error) return result;

    const rows = Array.isArray(result.data) ? result.data : [];

    if (!rows.length) {
      return {
        data: null,
        error: null,
        count: result.count ?? null,
      };
    }

    if (rows.length > 1) {
      return {
        data: null,
        error: {
          code: 'PGRST116',
          message: 'Multiple rows returned for maybeSingle()',
        },
        count: result.count ?? null,
      };
    }

    return {
      data: rows[0],
      error: null,
      count: result.count ?? null,
    };
  }

  then(resolvePromise, rejectPromise) {
    return this._execute().then(resolvePromise, rejectPromise);
  }
}


function storageBase() {
  return resolve(process.env.LOCAL_STORAGE_DIR || '/data/storage');
}

function safeStoragePath(bucket, objectPath = '') {
  const safeBucket = String(bucket || '').trim();

  if (!/^[A-Za-z0-9_-]+$/.test(safeBucket)) {
    throw new Error('Invalid storage bucket');
  }

  const root = resolve(storageBase(), safeBucket);

  const normalized = String(objectPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');

  const parts = normalized
    .split('/')
    .filter((part) => part && part !== '.');

  if (parts.some((part) => part === '..')) {
    throw new Error('Invalid storage path');
  }

  const full = resolve(root, ...parts);

  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error('Storage path escaped root');
  }

  return {
    root,
    full,
  };
}


const storage = {
  async createBucket(bucket) {
    try {
      const { root } = safeStoragePath(bucket);
      await fs.mkdir(root, { recursive: true });

      return {
        data: { name: bucket },
        error: null,
      };
    } catch (err) {
      return errorResult(err);
    }
  },

  async updateBucket(bucket) {
    try {
      const { root } = safeStoragePath(bucket);
      await fs.mkdir(root, { recursive: true });

      return {
        data: { name: bucket },
        error: null,
      };
    } catch (err) {
      return errorResult(err);
    }
  },

  from(bucket) {
    return {
      async upload(objectPath, bytes) {
        try {
          const { full } = safeStoragePath(bucket, objectPath);

          await fs.mkdir(dirname(full), { recursive: true });

          const body = Buffer.isBuffer(bytes)
            ? bytes
            : Buffer.from(bytes);

          await fs.writeFile(full, body);

          return {
            data: { path: objectPath },
            error: null,
          };
        } catch (err) {
          return errorResult(err);
        }
      },

      async download(objectPath) {
        try {
          const { full } = safeStoragePath(bucket, objectPath);
          const buffer = await fs.readFile(full);

          return {
            data: {
              async arrayBuffer() {
                return buffer.buffer.slice(
                  buffer.byteOffset,
                  buffer.byteOffset + buffer.byteLength,
                );
              },
            },
            error: null,
          };
        } catch (err) {
          if (err?.code === 'ENOENT') {
            return {
              data: null,
              error: { message: 'Object not found', code: 'ENOENT' },
            };
          }

          return errorResult(err);
        }
      },

      async createSignedUrl() {
        return {
          data: null,
          error: {
            message:
              'Signed object URLs are disabled on local dedicated storage',
          },
        };
      },
    };
  },
};


export function createClient() {
  return {
    from(table) {
      return new LocalQuery(table);
    },

    storage,
  };
}


export async function closeLocalDatabase() {
  if (_pool) {
    const pool = _pool;
    _pool = null;
    await pool.end();
  }
}
