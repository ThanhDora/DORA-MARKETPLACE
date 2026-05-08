export default function CatalogLoading() {
  return (
    <main className="catalog-v2 catalog-v2--loading" aria-busy="true" aria-live="polite">
      {/* Top progress bar */}
      <div className="catalog-progress is-on" aria-hidden="true" />

      {/* Hero skeleton */}
      <section className="catalog-v2__hero px-inline">
        <p className="catalog-v2__eyebrow">Khám phá</p>
        <div className="catalog-v2__hero-row">
          <h1 className="catalog-v2__heading">Kho sản phẩm số</h1>
          <div className="catalog-skel catalog-skel--hero-stat" />
        </div>
        <div className="catalog-skel catalog-skel--search" />
      </section>

      {/* Filter strip skeleton */}
      <section className="catalog-v2__filters px-inline">
        <div className="catalog-v2__filter-row">
          <span className="catalog-v2__filter-label">Loại</span>
          <div className="catalog-v2__pill-group">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="catalog-skel catalog-skel--pill" />
            ))}
          </div>
        </div>
        <div className="catalog-v2__filter-row">
          <span className="catalog-v2__filter-label">Danh mục</span>
          <div className="catalog-v2__pill-group catalog-v2__pill-group--scroll">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="catalog-skel catalog-skel--pill" />
            ))}
          </div>
        </div>
      </section>

      {/* Toolbar skeleton */}
      <section className="catalog-v2__toolbar px-inline">
        <div className="catalog-skel catalog-skel--toolbar" />
      </section>

      {/* Product grid skeleton */}
      <section className="catalog-v2__products px-inline">
        <div className="product-card-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="catalog-skel-card"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
