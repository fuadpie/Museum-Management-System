import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "../utils/currency";

const API_URL = "http://localhost:5000/api";
const token = () => localStorage.getItem("museumToken") || sessionStorage.getItem("museumToken");

async function api(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...options.headers },
    });
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    let data;
    try {
        data = contentType.includes("application/json") ? JSON.parse(body) : { message: "The server returned an unexpected response." };
    } catch {
        data = { message: "The server returned an invalid response." };
    }
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
    const [showPublicPreview, setShowPublicPreview] = useState(false);
    const [responseText, setResponseText] = useState("");
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", startDate: "", endDate: "", ticketPrice: "", coverImage: "", status: "OPEN" });
    const [artworkForm, setArtworkForm] = useState({ title: "", artistName: "", creationYear: "", category: "", description: "", exhibitionId: "", imageUrl: "" });
    const [museumForm, setMuseumForm] = useState({ name: "", location: "", phone: "", email: "", websiteUrl: "", description: "", openingTime: "", closingTime: "" });
    const [openMenu, setOpenMenu] = useState("");
    const [search, setSearch] = useState("");
    const [ticketData, setTicketData] = useState(null);
    const [ticketFilters, setTicketFilters] = useState({ search: "", date: "", exhibitionId: "", status: "", paymentStatus: "" });
    const [ticketPage, setTicketPage] = useState(1);
    const [ticketLoading, setTicketLoading] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const headerRef = useRef(null);
    const searchRef = useRef(null);

    useEffect(() => {
        api("/museum-manager/dashboard").then((dashboard) => { setData(dashboard); setMuseumForm({ name: dashboard.museum.name || "", location: dashboard.museum.location || "", phone: dashboard.museum.phone || "", email: dashboard.museum.email || "", websiteUrl: dashboard.museum.websiteUrl || "", description: dashboard.museum.description || "", openingTime: dashboard.museum.openingTime || "", closingTime: dashboard.museum.closingTime || "" }); }).catch((loadError) => {
            if (loadError.status === 401 || loadError.status === 403) {
                onLogout();
                return;
            }
            setError(loadError.message);
        });
    }, []);

    useEffect(() => {
        if (!data || section !== "Tickets") return;
        // Ticket filters synchronize the manager view with the protected API.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTicketLoading(true);
        const params = new URLSearchParams({ page: String(ticketPage), pageSize: "20", ...ticketFilters });
        Object.keys(ticketFilters).forEach((key) => { if (!ticketFilters[key]) params.delete(key); });
        api(`/museum-manager/tickets?${params.toString()}`).then(setTicketData).catch((loadError) => setError(loadError.message)).finally(() => setTicketLoading(false));
    }, [data, section, ticketFilters, ticketPage]);

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

    const averageRating = data.reviews?.length ? (data.reviews.reduce((total, review) => total + Number(review.rating || 0), 0) / data.reviews.length).toFixed(1) : "—";
    const activeExhibitions = data.exhibitions.filter((item) => item.status === "OPEN").length;
    const stats = [
        ["Total exhibitions", data.stats.exhibitions, `${activeExhibitions} Active`],
        ["Total artworks", data.stats.artworks, "Across your exhibitions"],
        ["Tickets sold", data.stats.tickets, `${data.paymentStats?.paid || 0} Paid`],
        ["Revenue", formatCurrency(data.stats.revenue), "All time"],
        ["Average rating", `★ ${averageRating}`, `${data.reviews?.length || 0} Reviews`],
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
    const toggleMuseumStatus = async () => {
        const nextStatus = data.museum.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        if (nextStatus === "INACTIVE" && !window.confirm(`Deactivate ${data.museum.name}? Historical bookings and records will be preserved.`)) return;
        setSaving(true);
        setError("");
        try {
            await api("/museum-manager/status", { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
            setData(await api("/museum-manager/dashboard"));
        } catch (statusError) {
            setError(statusError.message);
        } finally {
            setSaving(false);
        }
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
    const updateTicketFilter = (event) => { setTicketPage(1); setTicketFilters((current) => ({ ...current, [event.target.name]: event.target.value })); };
    const clearTicketFilters = () => { setTicketPage(1); setTicketFilters({ search: "", date: "", exhibitionId: "", status: "", paymentStatus: "" }); };
    const exportTickets = () => {
        if (!ticketData?.tickets?.length) return;
        const columns = ["Ticket ID", "Visitor", "Email", "Exhibition", "Visit Date", "Amount", "Payment", "Status", "Booked At"];
        const rows = ticketData.tickets.map((ticket) => [ticket.ticketId, ticket.visitorName, ticket.visitorEmail, ticket.exhibitionTitle, ticket.visitDate, ticket.amount, ticket.paymentStatus, ticket.status, ticket.bookedAt]);
        const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
        const link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        link.download = `tickets-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const nav = ["Dashboard", "Museum Profile", "Exhibitions", "Artworks", "Tickets", "Bookings", "Reviews", "Payments", "Reports"];
    const selectSection = (nextSection) => {
        setSection(nextSection);
        setOpenMenu("");
    };
    const managerName = data.museum.ownerName || "Museum Manager";
    const managerInitials = managerName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "M";
    const searchQuery = search.trim().toLowerCase();
    const searchResults = searchQuery ? [...data.exhibitions.filter((item) => `${item.title} ${item.description || ""}`.toLowerCase().includes(searchQuery)).slice(0, 3).map((item) => ({ type: "Exhibition", label: item.title, target: "Exhibitions" })), ...data.artworks.filter((item) => `${item.title} ${item.artistName || ""}`.toLowerCase().includes(searchQuery)).slice(0, 2).map((item) => ({ type: "Artwork", label: item.title, target: "Artworks" }))] : [];

    return <main className="manager-shell">
        {showResponseModal && <div className="modal-backdrop"><form className="booking-modal manager-form" onSubmit={(event) => { event.preventDefault(); setShowResponseModal(false); }}><button type="button" className="modal-close" onClick={() => setShowResponseModal(false)}>×</button><p className="eyebrow">Respond to review</p><h2>Write a response</h2><p>Replying to {selectedReview?.visitorName}.</p><textarea value={responseText} onChange={(event) => setResponseText(event.target.value)} rows="5" placeholder="Thank your visitor for sharing their experience." required /><button className="auth-submit">Send response</button></form></div>}
        {selectedTicket && <div className="modal-backdrop"><section className="booking-modal ticket-detail-modal" aria-labelledby="ticket-detail-title"><button type="button" className="modal-close" onClick={() => setSelectedTicket(null)} aria-label="Close ticket details">×</button><p className="eyebrow">Ticket details</p><h2 id="ticket-detail-title">TKT-{String(selectedTicket.ticketId).padStart(4, "0")}</h2><div className="ticket-detail-grid"><div><span>Visitor</span><strong>{selectedTicket.visitorName}</strong><small>{selectedTicket.visitorEmail}</small></div><div><span>Exhibition</span><strong>{selectedTicket.exhibitionTitle}</strong><small>{selectedTicket.museumName}</small></div><div><span>Visit date</span><strong>{selectedTicket.visitDate}</strong></div><div><span>Amount</span><strong>৳{Number(selectedTicket.amount || 0).toLocaleString()}</strong></div><div><span>Payment</span><strong>{selectedTicket.paymentStatus}</strong><small>{selectedTicket.paymentMethod || "Not available"}</small></div><div><span>Ticket status</span><strong>{selectedTicket.status}</strong><small>{selectedTicket.status === "CONFIRMED" ? "Confirmed and unused" : "Check-in data is not available"}</small></div></div></section></div>}
        {openMenu === "navigation" && <button className="manager-sidebar-backdrop" type="button" aria-label="Close manager navigation" onClick={() => setOpenMenu("")} />}
        <aside className={`manager-sidebar ${openMenu === "navigation" ? "open" : ""}`} onMouseDown={(event) => event.stopPropagation()}>
            <button className="brand manager-brand" onClick={() => selectSection("Dashboard")}><span>M</span> MUSEUM / 24</button>
            <p className="manager-label">Museum workspace</p>
            <nav>{nav.map((item) => <button type="button" className={section === item ? "active" : ""} key={item} onClick={() => selectSection(item)}><span>{["Dashboard", "Museum Profile", "Exhibitions", "Artworks", "Tickets", "Bookings", "Reviews", "Payments", "Reports"].indexOf(item) + 1}</span>{item}</button>)}</nav>
            <button className="manager-signout" onClick={onLogout}>Sign out</button>
        </aside>
        <section className={`manager-main ${section === "Reviews" ? "reviews-page" : ""}`}>
            <header className="manager-header manager-topbar" ref={headerRef}><button className="manager-topbar-menu" type="button" aria-label="Open manager navigation" aria-expanded={openMenu === "navigation"} onClick={() => setOpenMenu(openMenu === "navigation" ? "" : "navigation")}>☰</button><div className="manager-topbar-title"><p className="eyebrow">Museum manager</p><h1>{section}</h1></div><div className="manager-topbar-tools"><div className="manager-topbar-search-wrap"><label className="manager-topbar-search"><span aria-hidden="true">⌕</span><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Type in to Search..." aria-label="Search exhibitions and artworks" /><button type="button" onClick={() => setSearch("")} aria-label="Clear search" className={searchQuery ? "visible" : ""}>×</button></label>{searchQuery && <div className="manager-topbar-results" role="listbox">{searchResults.length ? searchResults.map((result) => <button type="button" key={`${result.type}-${result.label}`} onClick={() => { setSection(result.target); setSearch(""); }}><span>{result.type}</span><strong>{result.label}</strong></button>) : <p>No results found.</p>}</div>}</div><button className="manager-topbar-icon" type="button" aria-label="Open settings" aria-expanded={openMenu === "settings"} onClick={() => setOpenMenu(openMenu === "settings" ? "" : "settings")}>⚙</button><button className="manager-topbar-icon manager-topbar-notification" type="button" aria-label="Open notifications" aria-expanded={openMenu === "notifications"} onClick={() => setOpenMenu(openMenu === "notifications" ? "" : "notifications")}>♧<i /></button><button className="manager-topbar-profile" type="button" aria-haspopup="menu" aria-expanded={openMenu === "profile"} onClick={() => setOpenMenu(openMenu === "profile" ? "" : "profile")}><span className="manager-topbar-avatar">{managerInitials}</span><span><strong>{managerName}</strong><small>{data.museum.ownerRole || "MUSEUM_MANAGER"}</small></span><b aria-hidden="true">⌄</b></button>{openMenu === "profile" && <div className="manager-topbar-menu-panel" role="menu"><strong>{managerName}</strong><small>{data.museum.ownerEmail}</small><button role="menuitem" onClick={() => { setSection("Museum Profile"); setOpenMenu(""); }}>♙ My Profile</button><button role="menuitem" onClick={() => { setSection("Museum Profile"); setOpenMenu(""); }}>⚙ Account Settings</button><button role="menuitem" onClick={() => setOpenMenu("notifications")}>♧ Notifications</button><hr /><button className="manager-logout-item" role="menuitem" onClick={onLogout}>↪ Logout</button></div>}{openMenu === "settings" && <div className="manager-topbar-menu-panel" role="menu"><strong>Settings</strong><p>Manager account settings are available from Museum Profile.</p><button role="menuitem" onClick={() => { setSection("Museum Profile"); setOpenMenu(""); }}>Open settings</button></div>}{openMenu === "notifications" && <div className="manager-topbar-menu-panel" role="menu"><strong>Notifications</strong><p>No notifications yet.</p></div>}</div></header>
            {showPublicPreview && <div className="modal-backdrop"><section className="booking-modal museum-public-preview" aria-labelledby="public-preview-title"><button type="button" className="modal-close" onClick={() => setShowPublicPreview(false)} aria-label="Close public preview">×</button><p className="eyebrow">Public museum page preview</p><h2 id="public-preview-title">{data.museum.name}</h2><p>{data.museum.location}</p><p>{data.museum.description || "This museum has not added a public description yet."}</p><div className="museum-preview-hours"><strong>Opening hours</strong><span>{data.museum.openingTime || "Not provided"} — {data.museum.closingTime || "Not provided"}</span></div><h3>Current exhibitions</h3>{data.exhibitions.filter((item) => item.status === "OPEN").map((item) => <div className="manager-list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.startDate} — {item.endDate}</span></div><b>{formatCurrency(item.ticketPrice)}</b></div>)}{!data.exhibitions.filter((item) => item.status === "OPEN").length && <p className="manager-empty">No current exhibitions.</p>}</section></div>}
            <section className="museum-profile-hero">
                <div className="museum-cover-placeholder" role="img" aria-label={`${data.museum.name} cover placeholder`}><span>M</span></div>
                <div className="museum-identity">
                    <span className="eyebrow">Museum manager</span>
                    <h2>{data.museum.name}</h2>
                    <p>{data.museum.location}</p>
                    <span className={`status-pill ${(data.museum.status || "ACTIVE").toLowerCase()}`}>● {data.museum.status || "ACTIVE"}</span>
                    <div className="museum-hero-actions">
                        <button className="manager-primary" type="button" onClick={() => setSection("Museum Profile")}>Edit museum</button>
                        <button className="manager-secondary" type="button" onClick={() => setShowPublicPreview(true)}>View public page</button>
                        <button className="manager-secondary" type="button" onClick={() => setOpenMenu(openMenu === "actions" ? "" : "actions")}>⋮ Actions</button>
                    </div>
                    {openMenu === "actions" && <div className="museum-actions-menu"><button type="button" onClick={() => { setSection("Exhibitions"); setOpenMenu(""); }}>Add exhibition</button><button type="button" onClick={() => { setSection("Artworks"); setOpenMenu(""); }}>Add artwork</button><button type="button" onClick={toggleMuseumStatus}>{data.museum.status === "ACTIVE" ? "Deactivate museum" : "Activate museum"}</button></div>}
                </div>
            </section>
            <nav className="museum-profile-tabs" aria-label="Museum management sections">
                {[["Dashboard", "Overview"], ["Exhibitions", "Exhibitions"], ["Artworks", "Artworks"], ["Tickets", "Tickets"], ["Reviews", "Reviews"]].map(([value, label]) => <button type="button" className={section === value ? "active" : ""} key={value} onClick={() => selectSection(value)}>{label}</button>)}
            </nav>
            {section === "Dashboard" && <><div className="stats-grid manager-stats">{stats.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</div><div className="manager-columns"><div className="manager-panel"><p className="eyebrow">Museum information</p><h2>{data.museum.name}</h2><dl className="museum-information-list"><div><dt>Location</dt><dd>{data.museum.location}</dd></div><div><dt>Opening hours</dt><dd>{data.museum.openingTime || "Not provided"} — {data.museum.closingTime || "Not provided"}</dd></div><div><dt>Status</dt><dd>{data.museum.status || "ACTIVE"}</dd></div><div><dt>Created</dt><dd>{data.museum.createdAt ? new Date(data.museum.createdAt).toLocaleDateString() : "Not available"}</dd></div></dl><p className="museum-description">{data.museum.description || "No museum description has been added yet."}</p><button className="manager-secondary" type="button" onClick={() => setSection("Museum Profile")}>Edit information</button></div><div className="manager-panel"><p className="eyebrow">Your program</p><h2>Upcoming exhibitions</h2>{data.exhibitions.slice(0, 3).map((item) => <div className="manager-list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.startDate} — {item.endDate}</span></div><b>{formatCurrency(item.ticketPrice)}</b></div>)}{!data.exhibitions.length && <div className="manager-empty">No exhibitions found. Add your first exhibition.</div>}<button className="manager-secondary" type="button" onClick={() => setSection("Exhibitions")}>View all exhibitions</button></div></div></>}
            {section === "Museum Profile" && <section className="manager-panel manager-profile-editor"><p className="eyebrow">Museum information</p><h2>{data.museum.name}</h2><p>These details appear on your public museum page.</p><div className="museum-manager-summary"><div><strong>Status</strong><span className={`status-pill ${(data.museum.status || "ACTIVE").toLowerCase()}`}>● {data.museum.status || "ACTIVE"}</span></div><div><strong>Created</strong><span>{data.museum.createdAt ? new Date(data.museum.createdAt).toLocaleDateString() : "Not available"}</span></div><div><strong>Contact</strong><span>{data.museum.email || "Not provided"}</span></div></div><button className="manager-secondary" type="button" onClick={toggleMuseumStatus} disabled={saving}>{saving ? "Updating..." : data.museum.status === "ACTIVE" ? "Deactivate museum" : "Activate museum"}</button><form onSubmit={saveMuseumProfile}><div className="auth-field"><label htmlFor="museum-name">Museum name</label><input id="museum-name" value={museumForm.name} onChange={(event) => setMuseumForm({ ...museumForm, name: event.target.value })} required /></div><div className="auth-field"><label htmlFor="museum-location">Location</label><input id="museum-location" value={museumForm.location} onChange={(event) => setMuseumForm({ ...museumForm, location: event.target.value })} required /></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="museum-phone">Phone</label><input id="museum-phone" type="tel" value={museumForm.phone} onChange={(event) => setMuseumForm({ ...museumForm, phone: event.target.value })} /></div><div className="auth-field"><label htmlFor="museum-email">Email</label><input id="museum-email" type="email" value={museumForm.email} onChange={(event) => setMuseumForm({ ...museumForm, email: event.target.value })} /></div></div><div className="auth-field"><label htmlFor="museum-website">Website URL</label><input id="museum-website" type="url" placeholder="https://example.com" value={museumForm.websiteUrl} onChange={(event) => setMuseumForm({ ...museumForm, websiteUrl: event.target.value })} /></div><div className="auth-field"><label htmlFor="museum-description">Description</label><textarea id="museum-description" rows="5" value={museumForm.description} onChange={(event) => setMuseumForm({ ...museumForm, description: event.target.value })} /></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="museum-opening">Opening time</label><input id="museum-opening" placeholder="10:00" value={museumForm.openingTime} onChange={(event) => setMuseumForm({ ...museumForm, openingTime: event.target.value })} required /></div><div className="auth-field"><label htmlFor="museum-closing">Closing time</label><input id="museum-closing" placeholder="20:00" value={museumForm.closingTime} onChange={(event) => setMuseumForm({ ...museumForm, closingTime: event.target.value })} required /></div></div><button className="manager-primary" disabled={saving}>{saving ? "Saving..." : "Save museum details"}</button></form></section>}
            {section === "Exhibitions" && <section className="manager-panel manager-detail"><div className="manager-section-title"><div><p className="eyebrow">Your program</p><h2>Manage exhibitions</h2></div><button className="manager-primary" onClick={() => { setEditingExhibition(null); setForm({ title: "", description: "", startDate: "", endDate: "", ticketPrice: "", coverImage: "", status: "OPEN" }); setShowExhibitionForm(true); }}>+ Create exhibition</button></div><p>This workspace is limited to <strong>{data.museum.name}</strong>. Edit dates, pricing, visibility, and descriptions for existing exhibitions.</p>{data.exhibitions.map((item) => <div className="manager-list-item exhibition-manager-row" key={item.id}><div><strong>{item.title}</strong><span>{item.startDate} — {item.endDate} · {item.status}</span></div><b>{formatCurrency(item.ticketPrice)}</b><div className="manager-actions"><button onClick={() => { setEditingExhibition(item); setForm({ title: item.title, description: item.description || "", startDate: item.startDate, endDate: item.endDate, ticketPrice: item.ticketPrice, coverImage: item.coverImage || "", status: item.status }); setShowExhibitionForm(true); }}>Edit</button><button className="danger" onClick={async () => { if (!window.confirm(`Delete ${item.title}?`)) return; try { await api(`/museum-manager/exhibitions/${item.id}`, { method: "DELETE" }); setData(await api("/museum-manager/dashboard")); } catch (deleteError) { setError(deleteError.message); } }}>Delete</button></div></div>)}</section>}
            {section === "Bookings" && <section className="manager-panel manager-detail manager-bookings"><p className="eyebrow">Visitor activity</p><h2>Bookings for your exhibitions</h2><p>Only tickets booked for <strong>{data.museum.name}</strong> are shown here.</p><div className="booking-manager-table"><div className="booking-manager-heading"><span>Ticket ID</span><span>Visitor</span><span>Exhibition</span><span>Visit date</span><span>Status</span></div>{data.bookings.map((booking) => <div className="booking-manager-row" key={booking.ticketId}><span>T{booking.ticketId}</span><strong>{booking.visitorName}</strong><span>{booking.exhibitionTitle}</span><span>{booking.visitDate}</span><b className={`status-pill ${booking.status.toLowerCase()}`}>{booking.status}</b></div>)}</div>{!data.bookings.length && <div className="manager-empty">No bookings have been made for your exhibitions yet.</div>}</section>}
            {section === "Tickets" && <section className="ticket-management"><div className="ticket-page-header"><div><p className="eyebrow">Visitor activity</p><h2>Ticket Management</h2><p>Manage bookings, payments and visitor check-ins.</p></div><button className="manager-primary" type="button" onClick={exportTickets} disabled={!ticketData?.tickets?.length}>⇩ Export</button></div>{ticketData && <div className="ticket-kpis">{[["Total tickets", ticketData.stats.total], ["Today's visits", ticketData.stats.today], ["Confirmed", ticketData.stats.confirmed], ["Pending", ticketData.stats.pending], ["Cancelled", ticketData.stats.cancelled]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{Number(value || 0)}</strong></article>)}</div>}<div className="ticket-filters"><input name="search" value={ticketFilters.search} onChange={updateTicketFilter} placeholder="Search tickets..." aria-label="Search tickets" /><select name="date" value={ticketFilters.date} onChange={updateTicketFilter} aria-label="Filter by date"><option value="">All dates</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">This week</option><option value="month">This month</option></select><select name="exhibitionId" value={ticketFilters.exhibitionId} onChange={updateTicketFilter} aria-label="Filter by exhibition"><option value="">All exhibitions</option>{(ticketData?.exhibitions || data.exhibitions).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><select name="status" value={ticketFilters.status} onChange={updateTicketFilter} aria-label="Filter by ticket status"><option value="">All status</option><option value="CONFIRMED">Confirmed</option><option value="PENDING">Pending</option><option value="CANCELLED">Cancelled</option></select><select name="paymentStatus" value={ticketFilters.paymentStatus} onChange={updateTicketFilter} aria-label="Filter by payment status"><option value="">All payments</option><option value="SUCCESS">Paid</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option></select><button className="manager-secondary" type="button" onClick={clearTicketFilters}>Clear filters</button></div>{ticketLoading ? <div className="manager-empty">Loading tickets...</div> : ticketData?.tickets?.length ? <><div className="ticket-table"><div className="ticket-table-header"><span>Ticket</span><span>Visitor</span><span>Exhibition</span><span>Visit date</span><span>Amount</span><span>Payment</span><span>Status</span><span>Action</span></div>{ticketData.tickets.map((ticket) => <div className="ticket-table-row" key={ticket.ticketId}><button type="button" className="ticket-id" onClick={() => setSelectedTicket(ticket)}>TKT-{String(ticket.ticketId).padStart(4, "0")}</button><span><strong>{ticket.visitorName}</strong><small>{ticket.visitorEmail}</small></span><span>{ticket.exhibitionTitle}</span><span>{ticket.visitDate}</span><span>৳{Number(ticket.amount || 0).toLocaleString()}</span><span className="status-pill pending">{ticket.paymentStatus}</span><span className={`status-pill ${ticket.status.toLowerCase()}`}>{ticket.status}</span><button type="button" onClick={() => setSelectedTicket(ticket)}>View</button></div>)}</div><div className="ticket-pagination"><span>Showing page {ticketData.page} of {ticketData.totalPages} ({ticketData.total} tickets)</span><div><button type="button" disabled={ticketPage <= 1} onClick={() => setTicketPage((page) => page - 1)}>Previous</button><button type="button" disabled={ticketPage >= ticketData.totalPages} onClick={() => setTicketPage((page) => page + 1)}>Next</button></div></div></> : <div className="manager-empty"><h3>{ticketData?.total ? "No matching tickets" : "No tickets yet"}</h3><p>{ticketData?.total ? "Try changing your search or filters." : "Tickets will appear here when visitors make bookings."}</p>{ticketData?.total ? <button className="manager-secondary" type="button" onClick={clearTicketFilters}>Clear filters</button> : null}</div>}</section>}
            {["Artworks", "Payments", "Reports"].includes(section) && <section className="manager-panel manager-detail"><div className="manager-section-title"><div><p className="eyebrow">Collection</p><h2>{section}</h2></div>{section === "Artworks" && <button className="manager-primary" onClick={() => { setEditingArtwork(null); setArtworkForm({ title: "", artistName: "", creationYear: "", category: "", description: "", exhibitionId: data.exhibitions[0]?.id || "", imageUrl: "" }); setShowArtworkForm(true); }}>+ Add artwork</button>}</div><p>This workspace is limited to <strong>{data.museum.name}</strong>. Your team can manage only records belonging to this museum.</p>{section === "Artworks" && data.artworks.map((item) => <div className="manager-list-item exhibition-manager-row" key={item.id}><div><strong>{item.title}</strong><span>{item.artistName} · {item.exhibitionTitle} · {item.category || "Uncategorised"}</span></div><b>{item.creationYear || "—"}</b><div className="manager-actions"><button onClick={() => { setEditingArtwork(item); setArtworkForm({ title: item.title, artistName: item.artistName || "", creationYear: item.creationYear || "", category: item.category || "", description: item.description || "", exhibitionId: item.exhibitionId, imageUrl: item.imageUrl || "" }); setShowArtworkForm(true); }}>Edit</button><button className="danger" onClick={async () => { if (!window.confirm(`Delete ${item.title}?`)) return; try { await api(`/museum-manager/artworks/${item.id}`, { method: "DELETE" }); setData(await api("/museum-manager/dashboard")); } catch (deleteError) { setError(deleteError.message); } }}>Delete</button></div></div>)}{section === "Artworks" && !data.artworks.length && <div className="manager-empty">Add the first artwork to one of your exhibitions.</div>}{section !== "Artworks" && <div className="manager-empty">Your {section.toLowerCase()} data will appear here as visitors interact with your museum.</div>}</section>}
            {section === "Reviews" && <section className="reviews-workspace"><div className="reviews-column"><div className="reviews-title"><span>Review and rating</span><b> &gt; {data.museum.name}</b></div><div className="reviews-divider" />{data.reviews?.length ? data.reviews.map((review, index) => <article className={`review-dashboard-card ${selectedReview?.id === review.id ? "selected" : ""}`} key={review.id} onClick={() => setSelectedReview(review)}><div className="review-card-top"><span className="review-avatar">{review.visitorName?.slice(0, 1).toUpperCase()}</span><div><strong>{review.visitorName}</strong><time>{new Date(review.createdAt).toLocaleDateString()}</time></div><div className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} aria-label={`${star} star rating`} onMouseEnter={() => setHoveredRating(star)} onMouseLeave={() => setHoveredRating(0)} onClick={(event) => { event.stopPropagation(); setSelectedReview({ ...review, rating: star }); }}>{star <= (hoveredRating || review.rating) ? "★" : "☆"}</button>)}</div></div><p className="review-copy">“{review.comment}”</p><span className="review-helpful">◉ Q {index + 7}</span></article>) : <div className="manager-empty">No reviews have been submitted for your museum yet.</div>}</div>{selectedReview && <aside className="review-action-panel"><p className="eyebrow">Selected review</p><h2>{selectedReview.visitorName}</h2><p>Manage this visitor’s feedback for {data.museum.name}.</p><button className="review-action star-action" onClick={() => setSelectedReview({ ...selectedReview, starred: !selectedReview.starred })}>★ {selectedReview.starred ? "Starred" : "Star Review"}</button><button className="review-action respond-action" onClick={() => { setResponseText(""); setShowResponseModal(true); }}>↩ Respond</button><button className="review-ghost" onClick={downloadReview}>⇩ Download</button><button className="review-ghost delete-review" onClick={() => deleteReview(selectedReview.id)}>♢ Delete Review</button></aside>}</section>}
            {showExhibitionForm && <div className="modal-backdrop"><form className="booking-modal manager-form" onSubmit={createExhibition}><button type="button" className="modal-close" onClick={() => { setShowExhibitionForm(false); setEditingExhibition(null); }}>×</button><p className="eyebrow">Museum program</p><h2>{editingExhibition ? "Edit exhibition" : "Create exhibition"}</h2><div className="auth-field"><label htmlFor="title">Title</label><input id="title" name="title" value={form.title} onChange={updateForm} required /></div><div className="auth-field"><label htmlFor="description">Description</label><textarea id="description" name="description" value={form.description} onChange={updateForm} rows="3" /></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="startDate">Start date</label><input id="startDate" name="startDate" type="date" value={form.startDate} onChange={updateForm} required /></div><div className="auth-field"><label htmlFor="endDate">End date</label><input id="endDate" name="endDate" type="date" value={form.endDate} onChange={updateForm} required /></div></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="ticketPrice">Ticket price</label><input id="ticketPrice" name="ticketPrice" type="number" min="0" step="0.01" value={form.ticketPrice} onChange={updateForm} required /></div><div className="auth-field"><label htmlFor="status">Status</label><select id="status" name="status" value={form.status} onChange={updateForm}><option value="OPEN">Open</option><option value="CLOSED">Closed</option><option value="CANCELLED">Cancelled</option></select></div></div><div className="auth-field"><label htmlFor="coverImage">Cover image URL</label><input id="coverImage" name="coverImage" type="url" value={form.coverImage} onChange={updateForm} placeholder="https://..." /></div><button className="auth-submit" disabled={saving}>{saving ? "Publishing..." : "Publish exhibition →"}</button></form></div>}
            {showArtworkForm && <div className="modal-backdrop"><form className="booking-modal manager-form" onSubmit={saveArtwork}><button type="button" className="modal-close" onClick={() => { setShowArtworkForm(false); setEditingArtwork(null); }}>×</button><p className="eyebrow">Museum collection</p><h2>{editingArtwork ? "Edit artwork" : "Add artwork"}</h2><div className="auth-field"><label htmlFor="artwork-title">Title</label><input id="artwork-title" name="title" value={artworkForm.title} onChange={updateArtworkForm} required /></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="artistName">Artist</label><input id="artistName" name="artistName" value={artworkForm.artistName} onChange={updateArtworkForm} required /></div><div className="auth-field"><label htmlFor="creationYear">Year</label><input id="creationYear" name="creationYear" type="number" min="1" value={artworkForm.creationYear} onChange={updateArtworkForm} /></div></div><div className="auth-form-grid"><div className="auth-field"><label htmlFor="category">Category</label><input id="category" name="category" value={artworkForm.category} onChange={updateArtworkForm} placeholder="Painting" /></div><div className="auth-field"><label htmlFor="exhibitionId">Exhibition</label><select id="exhibitionId" name="exhibitionId" value={artworkForm.exhibitionId} onChange={updateArtworkForm} required>{data.exhibitions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div></div><div className="auth-field"><label htmlFor="artwork-description">Description</label><textarea id="artwork-description" name="description" value={artworkForm.description} onChange={updateArtworkForm} rows="3" /></div><div className="auth-field"><label htmlFor="imageUrl">Artwork image URL</label><input id="imageUrl" name="imageUrl" type="url" value={artworkForm.imageUrl} onChange={updateArtworkForm} placeholder="https://..." /></div><button className="auth-submit" disabled={saving}>{saving ? "Saving..." : "Save artwork →"}</button></form></div>}
        </section>
    </main>;
}

export default MuseumDashboard;
