import { useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:5000/api";
const token = () => localStorage.getItem("museumToken") || sessionStorage.getItem("museumToken");

async function api(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.message || "Unable to load dashboard.");
        error.status = response.status;
        throw error;
    }
    return data;
}

function MuseumDashboard({ onLogout }) {
    const [data, setData] = useState(null);
    const [section, setSection] = useState("Dashboard");
    const [error, setError] = useState("");
    const [showExhibitionForm, setShowExhibitionForm] = useState(false);
    const [editingExhibition, setEditingExhibition] = useState(null);
    const [showArtworkForm, setShowArtworkForm] = useState(false);
    const [editingArtwork, setEditingArtwork] = useState(null);
    const [selectedReview, setSelectedReview] = useState(null);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [showResponseModal, setShowResponseModal] = useState(false);
    const [responseText, setResponseText] = useState("");
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", startDate: "", endDate: "", ticketPrice: "", coverImage: "", status: "OPEN" });
    const [artworkForm, setArtworkForm] = useState({ title: "", artistName: "", creationYear: "", category: "", description: "", exhibitionId: "", imageUrl: "" });
    const [museumForm, setMuseumForm] = useState({ name: "", location: "", description: "", openingTime: "", closingTime: "" });
    const [openMenu, setOpenMenu] = useState("");
    const [search, setSearch] = useState("");
    const headerRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
        api("/museum-manager/dashboard").then((dashboard) => { setData(dashboard); setMuseumForm({ name: dashboard.museum.name || "", location: dashboard.museum.location || "", description: dashboard.museum.description || "", openingTime: dashboard.museum.openingTime || "", closingTime: dashboard.museum.closingTime || "" }); }).catch((loadError) => {
            if (loadError.status === 401 || loadError.status === 403) {
                onLogout();
                return;
            }
            setError(loadError.message);
        });
    }, []);

    useEffect(() => {
        const closeMenus = (event) => { if (!headerRef.current?.contains(event.target)) setOpenMenu(""); };
        const handleKeyDown = (event) => {
            if (event.key === "Escape") setOpenMenu("");
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
        };
        document.addEventListener("mousedown", closeMenus);
        document.addEventListener("keydown", handleKeyDown);
        return () => { document.removeEventListener("mousedown", closeMenus); document.removeEventListener("keydown", handleKeyDown); };
    }, []);

    if (error) return <main className="portal-loading">{error}</main>;
    if (!data) return <main className="portal-loading">Loading your museum workspace...</main>;

    const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    const createExhibition = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
            await api(`/museum-manager/exhibitions${editingExhibition ? `/${editingExhibition.id}` : ""}`, { method: editingExhibition ? "PUT" : "POST", body: JSON.stringify(form) });
            const refreshed = await api("/museum-manager/dashboard");
            setData(refreshed);
            setForm({ title: "", description: "", startDate: "", endDate: "", ticketPrice: "", coverImage: "", status: "OPEN" });
            setShowExhibitionForm(false);
            setEditingExhibition(null);
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setSaving(false);
        }
    };

    const stats = [
        ["Exhibitions", data.stats.exhibitions],
        ["Artworks", data.stats.artworks],
        ["Bookings", data.stats.bookings],
        ["Tickets", data.stats.tickets],
        ["Revenue", `$${Number(data.stats.revenue || 0).toFixed(2)}`],
        ["Today's revenue", `৳${Number(data.paymentStats?.todayRevenue || 0).toLocaleString()}`],
        ["This month", `৳${Number(data.paymentStats?.monthRevenue || 0).toLocaleString()}`],
        ["Paid", data.paymentStats?.paid || 0],
        ["Pending", data.paymentStats?.pending || 0],
        ["Refunded", data.paymentStats?.refunded || 0],
    ];
    const saveMuseumProfile = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
            await api("/museum-manager/profile", { method: "PUT", body: JSON.stringify(museumForm) });
            setData(await api("/museum-manager/dashboard"));
        } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
    };
    const updateArtworkForm = (event) => setArtworkForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    const saveArtwork = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError("");
        try {
            await api(`/museum-manager/artworks${editingArtwork ? `/${editingArtwork.id}` : ""}`, {
                method: editingArtwork ? "PUT" : "POST",
                body: JSON.stringify(artworkForm),
            });
            setData(await api("/museum-manager/dashboard"));
            setArtworkForm({ title: "", artistName: "", creationYear: "", category: "", description: "", exhibitionId: "", imageUrl: "" });
            setEditingArtwork(null);
            setShowArtworkForm(false);
        } catch (saveError) {
            setError(saveError.message);
        } finally {
            setSaving(false);
        }
    };
    const deleteReview = async (reviewId) => {
        if (!window.confirm("Delete this review?")) return;
        try {
            await api(`/museum-manager/reviews/${reviewId}`, { method: "DELETE" });
            setData(await api("/museum-manager/dashboard"));
            setSelectedReview(null);
        } catch (deleteError) { setError(deleteError.message); }
    };
    const downloadReview = () => {
        if (!selectedReview) return;
        const content = `${data.museum.name}\nVisitor: ${selectedReview.visitorName}\nRating: ${selectedReview.rating}/5\n\n${selectedReview.comment}`;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
        link.download = `review-${selectedReview.id}.txt`;
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const nav = ["Dashboard", "Museum Profile", "Exhibitions", "Artworks", "Tickets", "Bookings", "Reviews", "Payments", "Reports"];
    const managerName = data.museum.ownerName || "Museum Manager";
    const managerInitials = managerName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "M";
    const searchQuery = search.trim().toLowerCase();
    const searchResults = searchQuery ? [...data.exhibitions.filter((item) => `${item.title} ${item.description || ""}`.toLowerCase().includes(searchQuery)).slice(0, 3).map((item) => ({ type: "Exhibition", label: item.title, target: "Exhibitions" })), ...data.artworks.filter((item) => `${item.title} ${item.artistName || ""}`.toLowerCase().includes(searchQuery)).slice(0, 2).map((item) => ({ type: "Artwork", label: item.title, target: "Artworks" }))] : [];

    return <main className="manager-shell">
        {showResponseModal && <div className="modal-backdrop"><form className="booking-modal manager-form" onSubmit={(event) => { event.preventDefault(); setShowResponseModal(false); }}><button type="button" className="modal-close" onClick={() => setShowResponseModal(false)}>×</button><p className="eyebrow">Respond to review</p><h2>Write a response</h2><p>Replying to {selectedReview?.visitorName}.</p><textarea value={responseText} onChange={(event) => setResponseText(event.target.value)} rows="5" placeholder="Thank your visitor for sharing their experience." required /><button className="auth-submit">Send response</button></form></div>}
        {openMenu === "navigation" && <button className="manager-sidebar-backdrop" type="button" aria-label="Close manager navigation" onClick={() => setOpenMenu("")} />}
        <aside className={`manager-sidebar ${openMenu === "navigation" ? "open" : ""}`}>
            <button className="brand manager-brand" onClick={() => setSection("Dashboard")}><span>M</span> MUSEUM / 24</button>
            <p className="manager-label">Museum workspace</p>
            <nav>{nav.map((item) => <button className={section === item ? "active" : ""} key={item} onClick={() => setSection(item)}><span>{["Dashboard", "Museum Profile", "Exhibitions", "Artworks", "Tickets", "Bookings", "Reviews", "Payments", "Reports"].indexOf(item) + 1}</span>{item}</button>)}</nav>
            <button className="manager-signout" onClick={onLogout}>Sign out</button>
        </aside>
        <section className={`manager-main ${section === "Reviews" ? "reviews-page" : ""}`}>
            <header className="manager-header manager-topbar" ref={headerRef}><button className="manager-topbar-menu" type="button" aria-label="Open manager navigation" aria-expanded={openMenu === "navigation"} onClick={() => setOpenMenu(openMenu === "navigation" ? "" : "navigation")}>☰</button><div className="manager-topbar-title"><p className="eyebrow">Museum manager</p><h1>{section}</h1></div><div className="manager-topbar-tools"><div className="manager-topbar-search-wrap"><label className="manager-topbar-search"><span aria-hidden="true">⌕</span><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Type in to Search..." aria-label="Search exhibitions and artworks" /><button type="button" onClick={() => setSearch("")} aria-label="Clear search" className={searchQuery ? "visible" : ""}>×</button></label>{searchQuery && <div className="manager-topbar-results" role="listbox">{searchResults.length ? searchResults.map((result) => <button type="button" key={`${result.type}-${result.label}`} onClick={() => { setSection(result.target); setSearch(""); }}><span>{result.type}</span><strong>{result.label}</strong></button>) : <p>No results found.</p>}</div>}</div><button className="manager-topbar-icon" type="button" aria-label="Open settings" aria-expanded={openMenu === "settings"} onClick={() => setOpenMenu(openMenu === "settings" ? "" : "settings")}>⚙</button><button className="manager-topbar-icon manager-topbar-notification" type="button" aria-label="Open notifications" aria-expanded={openMenu === "notifications"} onClick={() => setOpenMenu(openMenu === "notifications" ? "" : "notifications")}>♧<i /></button><button className="manager-topbar-profile" type="button" aria-haspopup="menu" aria-expanded={openMenu === "profile"} onClick={() => setOpenMenu(openMenu === "profile" ? "" : "profile")}><span className="manager-topbar-avatar">{managerInitials}</span><span><strong>{managerName}</strong><small>{data.museum.ownerRole || "MUSEUM_MANAGER"}</small></span><b aria-hidden="true">⌄</b></button>{openMenu === "profile" && <div className="manager-topbar-menu-panel" role="menu"><strong>{managerName}</strong><small>{data.museum.ownerEmail}</small><button role="menuitem" onClick={() => { setSection("Museum Profile"); setOpenMenu(""); }}>♙ My Profile</button><button role="menuitem" onClick={() => { setSection("Museum Profile"); setOpenMenu(""); }}>⚙ Account Settings</button><button role="menuitem" onClick={() => setOpenMenu("notifications")}>♧ Notifications</button><hr /><button className="manager-logout-item" role="menuitem" onClick={onLogout}>↪ Logout</button></div>}{openMenu === "settings" && <div className="manager-topbar-menu-panel" role="menu"><strong>Settings</strong><p>Manager account settings are available from Museum Profile.</p><button role="menuitem" onClick={() => { setSection("Museum Profile"); setOpenMenu(""); }}>Open settings</button></div>}{openMenu === "notifications" && <div className="manager-topbar-menu-panel" role="menu"><strong>Notifications</strong><p>No notifications yet.</p></div>}</div></header>
            {section === "Dashboard" && <><div className="manager-welcome"><div><p className="eyebrow">Good morning</p><h2>Grow your museum’s<br /><em>next chapter.</em></h2><p>Keep your collection fresh, your exhibitions visible, and every visitor welcome.</p></div><div className="manager-mark">M</div></div><div className="stats-grid manager-stats">{stats.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="manager-columns"><div className="manager-panel"><p className="eyebrow">Your program</p><h2>Upcoming exhibitions</h2>{data.exhibitions.slice(0, 3).map((item) => <div className="manager-list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.startDate} — {item.endDate}</span></div><b>${Number(item.ticketPrice).toFixed(2)}</b></div>)}</div><div className="manager-panel manager-profile-card"><p className="eyebrow">Museum profile</p><h2>{data.museum.name}</h2><p>{data.museum.description}</p><span>{data.museum.openingTime || "10:00"} — {data.museum.closingTime || "20:00"}</span><button onClick={() => setSection("Museum Profile")}>Edit profile →</button></div></div></>}
            {section === "Museum Profile" && <section className="manager-panel manager-profile-editor"><p className="eyebrow">Public identity</p><h2>Edit museum details</h2><p>These details appear on your public museum page.</p><form onSubmit={saveMuseumProfile}><div className="auth-field"><label htmlFor="museum-name">Museum name</label><input id="museum-name" value={museumForm.name} onChange={(event) => setMuseumForm({ ...museumForm, name: event.target.value })} required /></div><div className="auth-field"><label htmlFor="museum-location">Location</label><input id="museum-location" value={museumForm.location} onChange={(event) => setMuseumForm({ ...museumForm, location: event.target.value })} required /></div><div className="auth-field"><label htmlFor="museum-description">Description</label><textarea id="museum-description" rows="5" value={museumForm.description} onChange={(event) => setMuseumForm({ ...museumForm, description: event.target.value })} /></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="museum-opening">Opening time</label><input id="museum-opening" placeholder="10:00" value={museumForm.openingTime} onChange={(event) => setMuseumForm({ ...museumForm, openingTime: event.target.value })} /></div><div className="auth-field"><label htmlFor="museum-closing">Closing time</label><input id="museum-closing" placeholder="20:00" value={museumForm.closingTime} onChange={(event) => setMuseumForm({ ...museumForm, closingTime: event.target.value })} /></div></div><button className="manager-primary" disabled={saving}>{saving ? "Saving..." : "Save museum details"}</button></form></section>}
            {section === "Exhibitions" && <section className="manager-panel manager-detail"><div className="manager-section-title"><div><p className="eyebrow">Your program</p><h2>Manage exhibitions</h2></div><button className="manager-primary" onClick={() => { setEditingExhibition(null); setForm({ title: "", description: "", startDate: "", endDate: "", ticketPrice: "", coverImage: "", status: "OPEN" }); setShowExhibitionForm(true); }}>+ Create exhibition</button></div><p>This workspace is limited to <strong>{data.museum.name}</strong>. Edit dates, pricing, visibility, and descriptions for existing exhibitions.</p>{data.exhibitions.map((item) => <div className="manager-list-item exhibition-manager-row" key={item.id}><div><strong>{item.title}</strong><span>{item.startDate} — {item.endDate} · {item.status}</span></div><b>${Number(item.ticketPrice).toFixed(2)}</b><div className="manager-actions"><button onClick={() => { setEditingExhibition(item); setForm({ title: item.title, description: item.description || "", startDate: item.startDate, endDate: item.endDate, ticketPrice: item.ticketPrice, coverImage: item.coverImage || "", status: item.status }); setShowExhibitionForm(true); }}>Edit</button><button className="danger" onClick={async () => { if (!window.confirm(`Delete ${item.title}?`)) return; try { await api(`/museum-manager/exhibitions/${item.id}`, { method: "DELETE" }); setData(await api("/museum-manager/dashboard")); } catch (deleteError) { setError(deleteError.message); } }}>Delete</button></div></div>)}</section>}
            {section === "Bookings" && <section className="manager-panel manager-detail manager-bookings"><p className="eyebrow">Visitor activity</p><h2>Bookings for your exhibitions</h2><p>Only tickets booked for <strong>{data.museum.name}</strong> are shown here.</p><div className="booking-manager-table"><div className="booking-manager-heading"><span>Ticket ID</span><span>Visitor</span><span>Exhibition</span><span>Visit date</span><span>Status</span></div>{data.bookings.map((booking) => <div className="booking-manager-row" key={booking.ticketId}><span>T{booking.ticketId}</span><strong>{booking.visitorName}</strong><span>{booking.exhibitionTitle}</span><span>{booking.visitDate}</span><b className={`status-pill ${booking.status.toLowerCase()}`}>{booking.status}</b></div>)}</div>{!data.bookings.length && <div className="manager-empty">No bookings have been made for your exhibitions yet.</div>}</section>}
            {["Artworks", "Tickets", "Reviews", "Payments", "Reports"].includes(section) && <section className="manager-panel manager-detail"><div className="manager-section-title"><div><p className="eyebrow">Collection</p><h2>{section}</h2></div>{section === "Artworks" && <button className="manager-primary" onClick={() => { setEditingArtwork(null); setArtworkForm({ title: "", artistName: "", creationYear: "", category: "", description: "", exhibitionId: data.exhibitions[0]?.id || "", imageUrl: "" }); setShowArtworkForm(true); }}>+ Add artwork</button>}</div><p>This workspace is limited to <strong>{data.museum.name}</strong>. Your team can manage only records belonging to this museum.</p>{section === "Artworks" && data.artworks.map((item) => <div className="manager-list-item exhibition-manager-row" key={item.id}><div><strong>{item.title}</strong><span>{item.artistName} · {item.exhibitionTitle} · {item.category || "Uncategorised"}</span></div><b>{item.creationYear || "—"}</b><div className="manager-actions"><button onClick={() => { setEditingArtwork(item); setArtworkForm({ title: item.title, artistName: item.artistName || "", creationYear: item.creationYear || "", category: item.category || "", description: item.description || "", exhibitionId: item.exhibitionId, imageUrl: item.imageUrl || "" }); setShowArtworkForm(true); }}>Edit</button><button className="danger" onClick={async () => { if (!window.confirm(`Delete ${item.title}?`)) return; try { await api(`/museum-manager/artworks/${item.id}`, { method: "DELETE" }); setData(await api("/museum-manager/dashboard")); } catch (deleteError) { setError(deleteError.message); } }}>Delete</button></div></div>)}{section === "Artworks" && !data.artworks.length && <div className="manager-empty">Add the first artwork to one of your exhibitions.</div>}{section !== "Artworks" && <div className="manager-empty">Your {section.toLowerCase()} data will appear here as visitors interact with your museum.</div>}</section>}
            {section === "Reviews" && <section className="reviews-workspace"><div className="reviews-column"><div className="reviews-title"><span>Review and rating</span><b> &gt; {data.museum.name}</b></div><div className="reviews-divider" />{data.reviews?.length ? data.reviews.map((review, index) => <article className={`review-dashboard-card ${selectedReview?.id === review.id ? "selected" : ""}`} key={review.id} onClick={() => setSelectedReview(review)}><div className="review-card-top"><span className="review-avatar">{review.visitorName?.slice(0, 1).toUpperCase()}</span><div><strong>{review.visitorName}</strong><time>{new Date(review.createdAt).toLocaleDateString()}</time></div><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} aria-label={`${star} star rating`} onMouseEnter={() => setHoveredRating(star)} onMouseLeave={() => setHoveredRating(0)} onClick={(event) => { event.stopPropagation(); setSelectedReview({ ...review, rating: star }); }}>{star <= (hoveredRating || review.rating) ? "★" : "☆"}</button>)}</div></div><p className="review-copy">“{review.comment}”</p><span className="review-helpful">◉ Q {index + 7}</span></article>) : <div className="manager-empty">No reviews have been submitted for your museum yet.</div>}</div>{selectedReview && <aside className="review-action-panel"><p className="eyebrow">Selected review</p><h2>{selectedReview.visitorName}</h2><p>Manage this visitor’s feedback for {data.museum.name}.</p><button className="review-action star-action" onClick={() => setSelectedReview({ ...selectedReview, starred: !selectedReview.starred })}>★ {selectedReview.starred ? "Starred" : "Star Review"}</button><button className="review-action respond-action" onClick={() => { setResponseText(""); setShowResponseModal(true); }}>↩ Respond</button><button className="review-ghost" onClick={downloadReview}>⇩ Download</button><button className="review-ghost delete-review" onClick={() => deleteReview(selectedReview.id)}>♢ Delete Review</button></aside>}</section>}
            {showExhibitionForm && <div className="modal-backdrop"><form className="booking-modal manager-form" onSubmit={createExhibition}><button type="button" className="modal-close" onClick={() => { setShowExhibitionForm(false); setEditingExhibition(null); }}>×</button><p className="eyebrow">Museum program</p><h2>{editingExhibition ? "Edit exhibition" : "Create exhibition"}</h2><div className="auth-field"><label htmlFor="title">Title</label><input id="title" name="title" value={form.title} onChange={updateForm} required /></div><div className="auth-field"><label htmlFor="description">Description</label><textarea id="description" name="description" value={form.description} onChange={updateForm} rows="3" /></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="startDate">Start date</label><input id="startDate" name="startDate" type="date" value={form.startDate} onChange={updateForm} required /></div><div className="auth-field"><label htmlFor="endDate">End date</label><input id="endDate" name="endDate" type="date" value={form.endDate} onChange={updateForm} required /></div></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="ticketPrice">Ticket price</label><input id="ticketPrice" name="ticketPrice" type="number" min="0" step="0.01" value={form.ticketPrice} onChange={updateForm} required /></div><div className="auth-field"><label htmlFor="status">Status</label><select id="status" name="status" value={form.status} onChange={updateForm}><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="CANCELLED">Cancelled</option></select></div></div><div className="auth-field"><label htmlFor="coverImage">Cover image URL</label><input id="coverImage" name="coverImage" type="url" value={form.coverImage} onChange={updateForm} placeholder="https://..." /></div><button className="auth-submit" disabled={saving}>{saving ? "Publishing..." : "Publish exhibition →"}</button></form></div>}
            {showArtworkForm && <div className="modal-backdrop"><form className="booking-modal manager-form" onSubmit={saveArtwork}><button type="button" className="modal-close" onClick={() => { setShowArtworkForm(false); setEditingArtwork(null); }}>×</button><p className="eyebrow">Museum collection</p><h2>{editingArtwork ? "Edit artwork" : "Add artwork"}</h2><div className="auth-field"><label htmlFor="artwork-title">Title</label><input id="artwork-title" name="title" value={artworkForm.title} onChange={updateArtworkForm} required /></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="artistName">Artist</label><input id="artistName" name="artistName" value={artworkForm.artistName} onChange={updateArtworkForm} required /></div><div className="auth-field"><label htmlFor="creationYear">Year</label><input id="creationYear" name="creationYear" type="number" min="1" value={artworkForm.creationYear} onChange={updateArtworkForm} /></div></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="category">Category</label><input id="category" name="category" value={artworkForm.category} onChange={updateArtworkForm} placeholder="Painting" /></div><div className="auth-field"><label htmlFor="exhibitionId">Exhibition</label><select id="exhibitionId" name="exhibitionId" value={artworkForm.exhibitionId} onChange={updateArtworkForm} required>{data.exhibitions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div></div><div className="auth-field"><label htmlFor="artwork-description">Description</label><textarea id="artwork-description" name="description" value={artworkForm.description} onChange={updateArtworkForm} rows="3" /></div><div className="auth-field"><label htmlFor="imageUrl">Artwork image URL</label><input id="imageUrl" name="imageUrl" type="url" value={artworkForm.imageUrl} onChange={updateArtworkForm} placeholder="https://..." /></div><button className="auth-submit" disabled={saving}>{saving ? "Saving..." : "Save artwork →"}</button></form></div>}
        </section>
    </main>;
}

export default MuseumDashboard;
