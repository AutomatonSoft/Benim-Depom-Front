const products = [
  {
    seller: "Nikita Gribanovsky",
    title: "Velvet lounge chair, green",
    type: "Chair",
    quantity: 20,
    status: "New",
    price: "€299",
    color: "#4fa87e",
  },
  {
    seller: "Aigerim K.",
    title: "Modern sofa, terracotta",
    type: "Sofa",
    quantity: 8,
    status: "Needs review",
    price: "€1,190",
    color: "#d77d57",
  },
  {
    seller: "Emre Yılmaz",
    title: "Oak dining table, 180 cm",
    type: "Table",
    quantity: 12,
    status: "New",
    price: "€749",
    color: "#b58a59",
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview">Benim<span>Depom</span></a>
        <nav aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><Icon>⌂</Icon> Overview</a>
          <a className="nav-item" href="#products"><Icon>▣</Icon> Products <b>12</b></a>
          <a className="nav-item" href="#sellers"><Icon>♙</Icon> Sellers</a>
          <a className="nav-item" href="#marketplaces"><Icon>◫</Icon> Marketplaces</a>
        </nav>
        <div className="sidebar-bottom">
          <a className="nav-item" href="#settings"><Icon>⚙</Icon> Settings</a>
          <div className="profile"><span>AK</span><div><strong>Alikhan</strong><small>Manager</small></div></div>
        </div>
      </aside>

      <section className="content" id="overview">
        <header className="topbar">
          <div><p className="eyebrow">Manager panel</p><h1>Good morning, Alikhan</h1></div>
          <button className="notification" aria-label="Notifications">♢<i /></button>
        </header>

        <div className="summary-grid">
          <article className="metric-card blue"><div><p>Awaiting review</p><strong>12</strong><small>+4 today</small></div><Icon>▣</Icon></article>
          <article className="metric-card orange"><div><p>Published today</p><strong>28</strong><small>Across 3 marketplaces</small></div><Icon>↗</Icon></article>
          <article className="metric-card white"><div><p>Active sellers</p><strong>146</strong><small>+9 this month</small></div><Icon>♙</Icon></article>
        </div>

        <section className="review-panel" id="products">
          <div className="panel-heading"><div><p className="eyebrow">Moderation queue</p><h2>Products awaiting review</h2></div><button className="link-button">View all products <span>→</span></button></div>
          <div className="filters"><button className="filter active">All <b>12</b></button><button className="filter">New <b>8</b></button><button className="filter">Needs review <b>4</b></button><button className="filter search">⌕ Search product or seller</button></div>
          <div className="product-list">
            {products.map((product) => (
              <article className="product-row" key={product.title}>
                <div className="product-image" style={{ background: `linear-gradient(135deg, ${product.color}, #f8f2e8)` }}><span>{product.type[0]}</span></div>
                <div className="product-main"><p>{product.type} <span className="dot">•</span> {product.seller}</p><h3>{product.title}</h3><small>Stock: {product.quantity} pcs</small></div>
                <span className={`status ${product.status === "New" ? "new" : "review"}`}>{product.status}</span>
                <strong className="price">{product.price}</strong>
                <button className="more" aria-label={`Open ${product.title}`}>⋮</button>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
