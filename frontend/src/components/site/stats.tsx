import { useSiteLanguage } from "@/hooks/use-site-language";
import { CountUp } from "@/components/anim";
const SIDE = [
  { value: "2min", label: "Avg. clone time" },
  { value: "99.2%", label: "Accuracy rate" },
  { value: "+9,000", label: "Active Users" },
  { value: "4.9/5", label: "User Rating" },
];
export function Stats() {
  const { t: tr, locale } = useSiteLanguage();
  return (
    <section className="metrics-section" aria-label={tr("Clonyfy in numbers")}>
      <div className="site-width metrics-layout">
        <div className="main-metric">
          <span className="section-index">{tr("A LITTLE PROOF. A LOT OF POSSIBILITY.")}</span>
          <strong>
            +<CountUp to={14600} format={(value) => value.toLocaleString(locale)} />
          </strong>
          <span>{tr("Websites cloned with Clonyfy")}</span>
        </div>
        <div className="side-metrics">
          {SIDE.map((s, i) => (
            <div key={s.label}>
              <span className="metric-index">0{i + 1} /</span>
              <strong>{tr(s.value)}</strong>
              <span>{tr(s.label)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
