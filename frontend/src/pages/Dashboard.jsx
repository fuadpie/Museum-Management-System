import { useEffect, useMemo, useRef, useState } from "react";

const API_URL = "http://localhost:5000/api";

function getToken() {
    return localStorage.getItem("museumToken") || sessionStorage.getItem("museumToken");
}

function getTodayDate() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${today.getFullYear()}-${month}-${day}`;
}

async function api(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...options.headers },
    });
    const data = await response.json();
    if (!response.ok) {
        const error = new Error(data.message || "Request failed.");
        error.status = response.status;
        throw error;
    }
    return data;
}

function Dashboard({ onLogout }) {
    const [user, setUser] = useState(null);
    const [museums, setMuseums] = useState([]);
    const [exhibitions, setExhibitions] = useState([]);
    const [artworks, setArtworks] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [adminStats, setAdminStats] = useState(null);
    const [section, setSection] = useState("discover");
    const [search, setSearch] = useState("");
    const [museumFilter, setMuseumFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");
    const [openNowOnly, setOpenNowOnly] = useState(false);
    const [minimumRating, setMinimumRating] = useState("0");
    const [museumSort, setMuseumSort] = useState("popular");
    const [exhibitionStatus, setExhibitionStatus] = useState({ ongoing: false, upcoming: false, endingSoon: false });
    const [exhibitionMuseumFilter, setExhibitionMuseumFilter] = useState([]);
    const [exhibitionPrice, setExhibitionPrice] = useState("all");
    const [exhibitionDate, setExhibitionDate] = useState("");
    const [exhibitionSort, setExhibitionSort] = useState("newest");
    const [bookingFilter, setBookingFilter] = useState("all");
    const [reviewForm, setReviewForm] = useState({ museumId: "", rating: "5", comment: "" });
    const [selectedExhibition, setSelectedExhibition] = useState(null);
    const [selectedMuseum, setSelectedMuseum] = useState(null);
    const [museumDetail, setMuseumDetail] = useState(null);
    const [museumDetailLoading, setMuseumDetailLoading] = useState(false);
    const [visitDate, setVisitDate] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isNightMode, setIsNightMode] = useState(() => localStorage.getItem("museumTheme") === "night");
    const [profileForm, setProfileForm] = useState({ name: "", phone: "", birthDate: "", city: "", country: "", interests: "" });
    const [profileTab, setProfileTab] = useState("personal");
    const [notificationPrefs, setNotificationPrefs] = useState(() => JSON.parse(localStorage.getItem("museumNotificationPrefs") || '{"booking":true,"reminder":true,"exhibitions":false,"newsletter":false}'));
    const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [passwordError, setPasswordError] = useState("");
    const [showPasswordFields, setShowPasswordFields] = useState(false);
    const [openMenu, setOpenMenu] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const headerRef = useRef(null);
    const searchRef = useRef(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [me, museumData, exhibitionData, artworkData, bookingData, reviewData] = await Promise.all([
                api("/auth/me"), api("/museums"), api("/exhibitions"), api("/artworks"), api("/bookings/my"), api("/reviews/my"),
            ]);
            setUser(me.user);
            setProfileForm({ name: me.user.name || "", phone: me.user.phone || "", birthDate: me.user.birthDate ? String(me.user.birthDate).slice(0, 10) : "", city: me.user.city || "", country: me.user.country || "", interests: me.user.interests || "" });
            setMuseums(museumData.museums);
            setExhibitions(exhibitionData.exhibitions);
            setArtworks(artworkData.artworks);
            setBookings(bookingData.bookings);
            setReviews(reviewData.reviews);
            if (me.user.role === "ADMIN") setAdminStats((await api("/admin/stats")).stats);
        } catch (loadError) {
            if (loadError.status === 401 || loadError.status === 403) {
                onLogout();
                return;
            }
            setError(loadError.message);
        } finally {
            setLoading(false);
        }
    };

    // The initial fetch synchronizes the portal with the authenticated API session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        const closeMenus = (event) => { if (!headerRef.current?.contains(event.target)) { setOpenMenu(""); setSidebarOpen(false); } };
        const handleKeyDown = (event) => {
            if (event.key === "Escape") setOpenMenu("");
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); }
        };
        document.addEventListener("mousedown", closeMenus);
        document.addEventListener("keydown", handleKeyDown);
        return () => { document.removeEventListener("mousedown", closeMenus); document.removeEventListener("keydown", handleKeyDown); };
    }, []);

    const filteredMuseums = useMemo(() => museums.filter((museum) => `${museum.name} ${museum.location}`.toLowerCase().includes(search.toLowerCase())), [museums, search]);
    const discoveryMuseums = useMemo(() => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const parseTime = (value) => {
            if (!value) return null;
            const match = String(value).match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
            if (!match) return null;
            let hours = Number(match[1]);
            const minutes = Number(match[2] || 0);
            if (match[3]?.toUpperCase() === "PM" && hours < 12) hours += 12;
            if (match[3]?.toUpperCase() === "AM" && hours === 12) hours = 0;
            return hours * 60 + minutes;
        };
        return filteredMuseums.filter((museum) => {
            const opening = parseTime(museum.openingTime);
            const closing = parseTime(museum.closingTime);
            const isOpen = opening !== null && closing !== null && (opening <= closing ? currentMinutes >= opening && currentMinutes <= closing : currentMinutes >= opening || currentMinutes <= closing);
            return (!locationFilter || `${museum.location} ${museum.name}`.toLowerCase().includes(locationFilter.toLowerCase())) && (!openNowOnly || isOpen) && Number(museum.rating || 0) >= Number(minimumRating);
        }).sort((left, right) => museumSort === "a-z" ? left.name.localeCompare(right.name) : museumSort === "newest" ? Number(right.id) - Number(left.id) : Number(right.rating || 0) - Number(left.rating || 0));
    }, [filteredMuseums, locationFilter, minimumRating, museumSort, openNowOnly]);
    const filteredExhibitions = useMemo(() => exhibitions.filter((item) => (!museumFilter || String(item.museumId) === museumFilter) && `${item.title} ${item.description || ""} ${item.museumName}`.toLowerCase().includes(search.toLowerCase())), [exhibitions, museumFilter, search]);
    const discoveryExhibitions = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysFromToday = (date) => Math.ceil((new Date(`${date}T00:00:00`) - today) / 86400000);
        const activeStatuses = Object.entries(exhibitionStatus).filter(([, enabled]) => enabled).map(([key]) => key);
        return exhibitions.filter((item) => {
            const startDays = daysFromToday(item.startDate);
            const endDays = daysFromToday(item.endDate);
            const ongoing = startDays <= 0 && endDays >= 0;
            const upcoming = startDays > 0;
            const endingSoon = ongoing && endDays <= 30;
            const statusMatch = !activeStatuses.length || activeStatuses.some((status) => status === "ongoing" ? ongoing : status === "upcoming" ? upcoming : endingSoon);
            const dateMatch = !exhibitionDate || item.startDate <= exhibitionDate && item.endDate >= exhibitionDate;
            const museumMatch = !exhibitionMuseumFilter.length || exhibitionMuseumFilter.includes(String(item.museumId));
            const priceMatch = exhibitionPrice === "all" || exhibitionPrice === "free" && Number(item.ticketPrice) === 0 || exhibitionPrice === "paid" && Number(item.ticketPrice) > 0;
            return statusMatch && dateMatch && museumMatch && priceMatch;
        }).sort((left, right) => exhibitionSort === "starting" ? left.startDate.localeCompare(right.startDate) : exhibitionSort === "price" ? Number(left.ticketPrice) - Number(right.ticketPrice) : right.startDate.localeCompare(left.startDate));
    }, [exhibitionDate, exhibitionMuseumFilter, exhibitionPrice, exhibitionSort, exhibitionStatus, exhibitions]);
    const filteredArtworks = useMemo(() => artworks.filter((item) => `${item.title} ${item.artistName} ${item.category || ""} ${item.exhibitionTitle} ${item.museumName}`.toLowerCase().includes(search.toLowerCase())), [artworks, search]);
    const filteredBookings = useMemo(() => bookings.filter((item) => bookingFilter === "all" || item.status.toLowerCase() === bookingFilter), [bookings, bookingFilter]);
    const featuredExhibitions = exhibitions.slice(0, 3);
    const pageTitles = { discover: "Dashboard", exhibitions: "Exhibitions", "exhibitions-discovery": "Exhibitions", artworks: "Artworks", bookings: "My bookings", profile: "Profile", reviews: "Reviews", admin: "Admin", "museum-detail": "Museum Details" };
    const initials = (user?.name || "").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "U";
    const searchGroups = [
        { label: "ARTWORKS", items: filteredArtworks.slice(0, 4).map((item) => ({ label: item.title, detail: item.artistName, action: () => setSection("artworks") })) },
        { label: "EXHIBITIONS", items: filteredExhibitions.slice(0, 4).map((item) => ({ label: item.title, detail: item.museumName, action: () => setSection("exhibitions") })) },
        { label: "MUSEUMS", items: filteredMuseums.slice(0, 4).map((item) => ({ label: item.name, detail: item.location, action: () => setSection("discover") })) },
    ].filter((group) => group.items.length);
    const searchResultCount = searchGroups.reduce((count, group) => count + group.items.length, 0);
    const hasSearch = search.trim().length > 0;

    const toggleTheme = () => {
        setIsNightMode((current) => {
            const next = !current;
            localStorage.setItem("museumTheme", next ? "night" : "day");
            return next;
        });
    };

    const bookTicket = async (event) => {
        event.preventDefault();
        try {
            const result = await api("/bookings", { method: "POST", body: JSON.stringify({ exhibitionId: selectedExhibition.id, visitDate }) });
            await api("/payments", { method: "POST", body: JSON.stringify({ ticketId: result.ticketId, paymentMethod: "CARD" }) });
            setMessage("Your ticket is confirmed. A confirmation has been added to My bookings.");
            setSelectedExhibition(null);
            setVisitDate("");
            await loadData();
        } catch (bookingError) { setError(bookingError.message); }
    };
    const saveProfile = async (event) => {
        event.preventDefault();
        setSaving(true);
        try { await api("/auth/profile", { method: "PUT", body: JSON.stringify(profileForm) }); setMessage("Profile updated."); await loadData(); } catch (saveError) { setError(saveError.message); } finally { setSaving(false); }
    };
    const toggleInterest = (interest) => {
        const selected = profileForm.interests.split(",").map((item) => item.trim()).filter(Boolean);
        const next = selected.includes(interest) ? selected.filter((item) => item !== interest) : [...selected, interest];
        setProfileForm({ ...profileForm, interests: next.join(", ") });
    };
    const updateNotification = (key) => {
        const next = { ...notificationPrefs, [key]: !notificationPrefs[key] };
        setNotificationPrefs(next);
        localStorage.setItem("museumNotificationPrefs", JSON.stringify(next));
    };
    const changePassword = async (event) => {
        event.preventDefault();
        setMessage("");
        setError("");
        setPasswordError("");
        if (passwordForm.currentPassword === passwordForm.newPassword) {
            setPasswordError("Your new password must be different from your current password.");
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError("New password and confirmation do not match.");
            return;
        }
        setSaving(true);
        try { await api("/auth/password", { method: "PUT", body: JSON.stringify(passwordForm) }); setMessage("Password changed."); setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); } catch (saveError) { setPasswordError(saveError.message); } finally { setSaving(false); }
    };
    const submitReview = async (event) => {
        event.preventDefault();
        try { await api("/reviews", { method: "POST", body: JSON.stringify(reviewForm) }); setMessage("Review submitted."); setReviewForm({ museumId: "", rating: "5", comment: "" }); await loadData(); } catch (reviewError) { setError(reviewError.message); }
    };
    const openMuseumDetail = async (museum) => {
        setSection("museum-detail");
        setSelectedMuseum(museum);
        setMuseumDetail(null);
        setError("");
        setMuseumDetailLoading(true);
        try { setMuseumDetail(await api(`/museums/${museum.id}`)); } catch (detailError) { setError(detailError.message); } finally { setMuseumDetailLoading(false); }
    };
    const openMuseumExhibitions = () => {
        setSearch("");
        setMuseumFilter(String(museumDetail?.museum.id || selectedMuseum?.id || ""));
        setSection("exhibitions");
    };

    if (loading) return <main className="portal-loading">Loading the collection...</main>;

    return (
        <main className={`portal ${isNightMode ? "night-mode" : ""}`}>
            <header className="portal-header user-dashboard-header" ref={headerRef}>
                <button className="dashboard-menu-toggle" type="button" aria-label="Open dashboard navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}><span /><span /><span /></button>
                <button className="brand user-header-brand" onClick={() => setSection("discover")}><span>M</span> MUSEUM / 24</button>
                <div className="user-header-title"><p className="eyebrow">Museum member</p><h1>{pageTitles[section] || "Dashboard"}</h1></div>
                <nav className={`dashboard-navigation ${sidebarOpen ? "open" : ""}`} aria-label="Primary navigation">
                    <button className={section === "discover" ? "active" : ""} onClick={() => { setSection("discover"); setSidebarOpen(false); }}>Discover</button>
                    <button className={section === "exhibitions-discovery" ? "active" : ""} onClick={() => { setSection("exhibitions-discovery"); setSidebarOpen(false); }}>Exhibitions</button>
                    <button className={section === "artworks" ? "active" : ""} onClick={() => { setSection("artworks"); setSidebarOpen(false); }}>Artworks</button>
                    <button className={section === "bookings" ? "active" : ""} onClick={() => { setSection("bookings"); setSidebarOpen(false); }}>My bookings ({bookings.length})</button>
                    <button className={section === "profile" ? "active" : ""} onClick={() => { setSection("profile"); setSidebarOpen(false); }}>Profile</button>
                    <button className={section === "reviews" ? "active" : ""} onClick={() => { setSection("reviews"); setSidebarOpen(false); }}>Reviews</button>
                    {user?.role === "ADMIN" && <button className={section === "admin" ? "active" : ""} onClick={() => { setSection("admin"); setSidebarOpen(false); }}>Admin</button>}
                </nav>
                <div className="user-header-tools">
                    <div className="header-search-wrap">
                        <label className="header-search"><span aria-hidden="true">⌕</span><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && searchGroups[0]?.items[0]) { event.preventDefault(); searchGroups[0].items[0].action(); setOpenMenu(""); } }} placeholder="Search museums, exhibitions, artworks, artists..." aria-label="Search museums, exhibitions, artworks, and artists" /><button type="button" onClick={() => setSearch("")} aria-label="Clear search" className={hasSearch ? "visible" : ""}>×</button></label>
                        {hasSearch && <div className="header-search-results grouped-search-results" role="listbox" aria-label={`${searchResultCount} search results`}>{searchGroups.length ? searchGroups.map((group) => <section key={group.label}><h3>{group.label}</h3>{group.items.map((result) => <button type="button" key={`${group.label}-${result.label}`} onClick={() => { result.action(); setSearch(""); setOpenMenu(""); }}><strong>{result.label}</strong><span>{result.detail}</span></button>)}</section>) : <p>No results found.</p>}</div>}
                    </div>
                    <button className={`theme-toggle ${isNightMode ? "night" : ""}`} type="button" aria-label={`Switch to ${isNightMode ? "day" : "night"} mode`} aria-pressed={isNightMode} onClick={toggleTheme}><span aria-hidden="true">☼</span><i aria-hidden="true" /><span aria-hidden="true">☾</span></button>
                    <button className="header-icon notification-trigger" type="button" aria-label="Open notifications" aria-expanded={openMenu === "notifications"} onClick={() => setOpenMenu(openMenu === "notifications" ? "" : "notifications")}>♧<i /></button>
                    <button className="header-profile-trigger" type="button" aria-haspopup="menu" aria-expanded={openMenu === "profile"} onClick={() => setOpenMenu(openMenu === "profile" ? "" : "profile")}><span className="header-avatar">{initials}</span><span className="header-profile-copy"><strong>{user?.name || "Loading profile..."}</strong><small>{user?.role || "Member"}</small></span><span aria-hidden="true">⌄</span></button>
                    {openMenu === "profile" && <div className="header-menu profile-menu" role="menu"><div className="header-menu-user"><span className="header-avatar">{initials}</span><div><strong>{user?.name}</strong><small>{user?.email}</small></div></div><button role="menuitem" onClick={() => { setSection("profile"); setProfileTab("personal"); setOpenMenu(""); }}>♙ My Profile</button><button role="menuitem" onClick={() => { setSection("profile"); setProfileTab("personal"); setOpenMenu(""); }}>⚙ Account Settings</button><button role="menuitem" onClick={() => { setSection("profile"); setProfileTab("notifications"); setOpenMenu(""); }}>♧ Notifications</button><hr /><button className="logout-menu-item" role="menuitem" onClick={onLogout}>↪ Logout</button></div>}
                    {openMenu === "notifications" && <div className="header-menu notification-menu" role="menu"><strong>Notifications</strong>{bookings.length ? <><p className="notification-item">You have {bookings.length} booking{bookings.length === 1 ? "" : "s"} in your visit history.</p><p className="notification-item">Your latest visit is {bookings[0].visitDate}.</p></> : <p>No notifications yet.</p>}<button role="menuitem" onClick={() => { setSection("profile"); setProfileTab("notifications"); setOpenMenu(""); }}>Open notification settings</button></div>}
                </div>
            </header>
            {(message || error) && <div className={message ? "notice success" : "notice error"}>{message || error}<button onClick={() => { setMessage(""); setError(""); }}>×</button></div>}
            <section className="portal-hero">
                <div><p className="eyebrow">A living archive of wonder</p><h1>Make time for<br /><em>what moves you.</em></h1><p>Discover exhibitions, collect moments, and plan your next visit to the world's most remarkable rooms.</p></div>
                <div className="hero-orbit"><span>EST.<br />1924</span></div>
            </section>
            {section === "museum-detail" && <section className="portal-content museum-detail-page">{museumDetailLoading && <p className="portal-loading">Loading museum details...</p>}{museumDetail && <><button className="museum-back-button" onClick={() => setSection("discover")}>← Back to museums</button><section className="museum-hero"><div><p className="eyebrow">Museum profile</p><h2>{museumDetail.museum.name}</h2><p className="museum-location">⌖ {museumDetail.museum.location}</p><button className="primary-button museum-exhibitions-cta" onClick={openMuseumExhibitions}>Explore Exhibitions →</button></div><div className="museum-hero-mark">{museumDetail.museum.name.slice(0, 1)}</div></section><div className="museum-detail-grid"><section><div className="museum-detail-section"><p className="eyebrow">About the museum</p><p>{museumDetail.museum.description || "Discover art, history, and new perspectives in this museum's collection."}</p></div><div className="museum-detail-section"><p className="eyebrow">Opening hours</p><div className="opening-hours"><span>Every day</span><strong>{museumDetail.museum.openingTime || "10:00"} – {museumDetail.museum.closingTime || "20:00"}</strong></div></div><div className="museum-detail-section"><p className="eyebrow">Current exhibitions</p><div className="museum-detail-cards">{museumDetail.exhibitions.map((item) => <article key={item.id}><p className="card-meta">{item.startDate} – {item.endDate}</p><h3>{item.title}</h3><p>{item.description}</p><button onClick={() => { setSearch(item.title); setSection("exhibitions"); }}>View exhibition →</button></article>)}</div>{!museumDetail.exhibitions.length && <p className="empty">No current exhibitions.</p>}</div><div className="museum-detail-section"><p className="eyebrow">Featured artworks</p><div className="museum-artwork-row">{museumDetail.artworks.slice(0, 3).map((item) => <article key={item.id}><div className="artwork-image">{item.imageUrl ?             <img src={item.imageUrl} alt={item.title} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : item.title.slice(0, 1)}</div><h3>{item.title}</h3><p>{item.artistName}</p></article>)}</div>{!museumDetail.artworks.length && <p className="empty">No artworks listed yet.</p>}</div><div className="museum-detail-section"><p className="eyebrow">Visitor reviews</p><div className="museum-review-list">{museumDetail.reviews.slice(0, 3).map((review) => <article key={review.id}><strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong><p>“{review.comment}”</p><small>{review.visitorName}</small></article>)}</div>{!museumDetail.reviews.length && <p className="empty">No visitor reviews yet.</p>}<button className="primary-button" onClick={() => { setReviewForm({ ...reviewForm, museumId: museumDetail.museum.id }); setSection("reviews"); }}>Write a Review</button></div></section></div></>}</section>}
            {section === "discover" && <section className="portal-content">
                <div className="museums-discovery-heading"><div><p className="eyebrow">Museum directory</p><h2>Explore Museums</h2></div><label className="museum-search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search museums..." aria-label="Search museums" /></label></div>
                <div className="museums-discovery-layout"><aside className="museum-filters"><strong>Filters</strong><label>Location<input value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder="City or country" /></label><label className="filter-check"><input type="checkbox" checked={openNowOnly} onChange={(event) => setOpenNowOnly(event.target.checked)} /> Open now</label><label>Rating<select value={minimumRating} onChange={(event) => setMinimumRating(event.target.value)}><option value="0">Any rating</option><option value="4">4+ stars</option><option value="3">3+ stars</option></select></label><button type="button" className="clear-filters" onClick={() => { setLocationFilter(""); setOpenNowOnly(false); setMinimumRating("0"); setMuseumSort("popular"); }}>Clear filters</button></aside><div className="museums-results"><div className="museums-results-toolbar"><span>{discoveryMuseums.length} museums</span><label>Sort<select value={museumSort} onChange={(event) => setMuseumSort(event.target.value)}><option value="popular">Popular</option><option value="newest">Newest</option><option value="a-z">A-Z</option></select></label></div><div className="card-grid">{discoveryMuseums.map((museum) => <article className="museum-card discovery-museum-card" key={museum.id}><div className="card-art">{museum.name.slice(0, 1)}</div><div className="card-body"><h3>{museum.name}</h3><p className="museum-location">⌖ {museum.location}</p><p className="museum-rating">★ {Number(museum.rating || 0).toFixed(1)}</p><p className="museum-count">{museum.exhibitionCount || 0} exhibitions</p><button onClick={() => openMuseumDetail(museum)}>View museum →</button></div></article>)}</div>{!discoveryMuseums.length && <p className="empty">No museums match these filters.</p>}</div></div>
                <div className="section-heading compact"><div><p className="eyebrow">Now showing</p><h2>Featured exhibitions</h2></div><button className="text-button" onClick={() => setSection("exhibitions")}>See all →</button></div>
                <div className="exhibition-strip">{featuredExhibitions.map((exhibition) => <article key={exhibition.id}><p className="card-meta">{exhibition.museumName} · {exhibition.startDate}</p><h3>{exhibition.title}</h3><p>{exhibition.description}</p><button onClick={() => setSelectedExhibition(exhibition)}>Book from ${Number(exhibition.ticketPrice || 0).toFixed(2)} →</button></article>)}</div>
            </section>}
            {section === "exhibitions-discovery" && <section className="portal-content exhibitions-discovery-page"><div className="museums-discovery-heading"><div><p className="eyebrow">The program</p><h2>Discover Exhibitions</h2></div><label className="museum-search-field"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exhibitions" aria-label="Search exhibitions" /></label></div><div className="exhibitions-discovery-layout"><aside className="museum-filters exhibition-filters"><strong>Filters</strong><fieldset><legend>Status</legend>{[["ongoing", "Ongoing"], ["upcoming", "Upcoming"], ["endingSoon", "Ending soon"]].map(([value, label]) => <label className="filter-check" key={value}><input type="checkbox" checked={exhibitionStatus[value]} onChange={(event) => setExhibitionStatus({ ...exhibitionStatus, [value]: event.target.checked })} /> {label}</label>)}</fieldset><fieldset><legend>Museum</legend>{museums.map((museum) => <label className="filter-check" key={museum.id}><input type="checkbox" checked={exhibitionMuseumFilter.includes(String(museum.id))} onChange={(event) => setExhibitionMuseumFilter(event.target.checked ? [...exhibitionMuseumFilter, String(museum.id)] : exhibitionMuseumFilter.filter((id) => id !== String(museum.id)))} /> {museum.name}</label>)}</fieldset><fieldset><legend>Price</legend>{[["free", "Free"], ["paid", "Paid"]].map(([value, label]) => <label className="filter-check" key={value}><input type="radio" name="exhibition-price" checked={exhibitionPrice === value} onChange={() => setExhibitionPrice(value)} /> {label}</label>)}<label className="filter-check"><input type="radio" name="exhibition-price" checked={exhibitionPrice === "all"} onChange={() => setExhibitionPrice("all")} /> All prices</label></fieldset><label>Date<input type="date" value={exhibitionDate} onChange={(event) => setExhibitionDate(event.target.value)} /></label><button type="button" className="clear-filters" onClick={() => { setExhibitionStatus({ ongoing: false, upcoming: false, endingSoon: false }); setExhibitionMuseumFilter([]); setExhibitionPrice("all"); setExhibitionDate(""); setExhibitionSort("newest"); }}>Clear filters</button></aside><div className="museums-results"><div className="museums-results-toolbar"><span>{discoveryExhibitions.length} exhibitions</span><label>Sort<select value={exhibitionSort} onChange={(event) => setExhibitionSort(event.target.value)}><option value="newest">Newest</option><option value="starting">Starting soon</option><option value="price">Price low → high</option></select></label></div><div className="card-grid exhibition-discovery-grid">{discoveryExhibitions.map((exhibition) => <article className="list-card exhibition-discovery-card" key={exhibition.id}><div className="exhibition-card-art">{exhibition.title.slice(0, 1)}</div><div className="exhibition-card-body"><p className="card-meta">{exhibition.museumName}</p><h3>{exhibition.title}</h3><p className="exhibition-date">{exhibition.startDate} – {exhibition.endDate}</p><strong>{Number(exhibition.ticketPrice || 0) === 0 ? "Free" : `৳${Number(exhibition.ticketPrice).toLocaleString()}`}</strong><button onClick={() => setSelectedExhibition(exhibition)}>View exhibition →</button></div></article>)}</div>{!discoveryExhibitions.length && <p className="empty">No exhibitions match these filters.</p>}</div></div></section>}
            {section === "artworks" && <section className="portal-content"><div className="section-heading"><div><p className="eyebrow">From the collection</p><h2>Artworks</h2></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search artist, title, category" /></div><div className="artwork-grid">{filteredArtworks.map((artwork) => <article key={artwork.id}><div className="artwork-image">{artwork.imageUrl ?             <img src={artwork.imageUrl} alt={artwork.title} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : artwork.title.slice(0, 1)}</div><p className="card-meta">{artwork.category || "Collection"} · {artwork.creationYear || "Undated"}</p><h3>{artwork.title}</h3><p>{artwork.artistName}</p><small>{artwork.exhibitionTitle} · {artwork.museumName}<br />{artwork.description}</small></article>)}</div></section>}
            {section === "bookings" && <section className="portal-content"><div className="section-heading"><div><p className="eyebrow">Your visits</p><h2>My bookings</h2></div><select value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value)}><option value="all">All bookings</option><option value="confirmed">Upcoming / confirmed</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option></select></div>{filteredBookings.length ? <div className="booking-list">{filteredBookings.map((booking) => <article key={booking.id}><div><p className="card-meta">{booking.museumName}</p><h3>{booking.exhibitionTitle}</h3><p>Visit date: <strong>{booking.visitDate}</strong> · Ticket #{booking.id}</p><button className="text-button" onClick={() => window.print()}>Print ticket</button></div><span className={`status-pill ${booking.status.toLowerCase()}`}>{booking.status}</span></article>)}</div> : <p className="empty">No bookings match this filter.</p>}</section>}
            {section === "profile" && <section className="portal-content profile-page">
                <div className="profile-hero-card"><div className="profile-avatar-large">{initials}</div><div className="profile-hero-copy"><h2>{user.name}</h2><p>{user.email} · Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "recently"}</p><div className="profile-progress"><span /><small>{Math.min(100, Math.round(([profileForm.name, profileForm.phone, profileForm.birthDate, profileForm.city, profileForm.country, profileForm.interests].filter(Boolean).length / 6) * 100))}% complete</small></div></div><button className="manager-primary" type="button" onClick={() => setProfileTab("personal")}>Edit profile</button></div>
                <div className="profile-stat-grid"><article><small>Upcoming</small><strong>{bookings.filter((booking) => booking.status === "CONFIRMED").length}</strong></article><article><small>Museums visited</small><strong>{new Set(bookings.map((booking) => booking.museumName)).size}</strong></article><article><small>Reviews</small><strong>{reviews.length}</strong></article><article><small>Saved</small><strong>0</strong></article></div>
                <div className="profile-workspace"><aside className="profile-tabs">{[["personal", "♙", "Personal info"], ["interests", "♡", "Interests"], ["notifications", "♧", "Notifications"], ["security", "▣", "Security"], ["privacy", "◇", "Privacy and data"]].map(([key, icon, label]) => <button type="button" className={profileTab === key ? "active" : ""} key={key} onClick={() => setProfileTab(key)}><span>{icon}</span>{label}</button>)}</aside><div className="profile-panels">
                    {profileTab === "personal" && <form className="profile-panel" onSubmit={saveProfile}><h3>Personal info</h3><div className="profile-fields"><label>Full name<input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} required /></label><label>Phone<input value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} /></label><label>Birth date<input type="date" value={profileForm.birthDate} onChange={(event) => setProfileForm({ ...profileForm, birthDate: event.target.value })} /></label><label>Country<input value={profileForm.country} onChange={(event) => setProfileForm({ ...profileForm, country: event.target.value })} /></label><label>City<input value={profileForm.city} onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })} /></label><label>Email<input value={user.email} disabled /></label></div><div className="profile-actions">                    <button type="button" onClick={() => setProfileTab("personal")}>Cancel</button><button className="primary-button" disabled={saving}>Save changes</button></div></form>}
                    {profileTab === "interests" && <div className="profile-panel"><h3>Interests</h3><p>Choose topics to personalize exhibition recommendations.</p><div className="interest-chips">{["Modern art", "History", "Sculpture", "Photography", "Archaeology", "Science", "Design", "Textiles"].map((interest) => <button type="button" className={profileForm.interests.split(",").map((item) => item.trim()).includes(interest) ? "selected" : ""} key={interest} onClick={() => toggleInterest(interest)}>{profileForm.interests.split(",").map((item) => item.trim()).includes(interest) ? "✓ " : ""}{interest}</button>)}</div><button className="primary-button profile-save-button" onClick={saveProfile}>Save interests</button></div>}
                    {profileTab === "notifications" && <div className="profile-panel"><h3>Notifications</h3><p>Control the updates you receive from Museum / 24.</p>{[["booking", "Booking confirmations"], ["reminder", "Visit reminder, 24 hours before"], ["exhibitions", "New exhibitions matching my interests"], ["newsletter", "Newsletter"]].map(([key, label]) => <label className="notification-row" key={key}><span>{label}</span><button type="button" aria-pressed={notificationPrefs[key]} className={`toggle-switch ${notificationPrefs[key] ? "on" : ""}`} onClick={() => updateNotification(key)}><i /></button></label>)}</div>}
                    {profileTab === "security" && <form className="profile-panel" onSubmit={changePassword}><h3>Security</h3><p>Keep your account protected with a strong password.</p><label>Current password<div className="profile-password-wrap"><input type={showPasswordFields ? "text" : "password"} value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /><button type="button" onClick={() => setShowPasswordFields((visible) => !visible)}>{showPasswordFields ? "Hide" : "Show"}</button></div></label><label>New password<div className="profile-password-wrap"><input type={showPasswordFields ? "text" : "password"} minLength="8" value={passwordForm.newPassword} onChange={(event) => { setPasswordForm({ ...passwordForm, newPassword: event.target.value }); setPasswordError(""); }} required /><button type="button" onClick={() => setShowPasswordFields((visible) => !visible)}>{showPasswordFields ? "Hide" : "Show"}</button></div></label><label>Confirm new password<div className="profile-password-wrap"><input type={showPasswordFields ? "text" : "password"} value={passwordForm.confirmPassword} onChange={(event) => { setPasswordForm({ ...passwordForm, confirmPassword: event.target.value }); setPasswordError(""); }} required /><button type="button" onClick={() => setShowPasswordFields((visible) => !visible)}>{showPasswordFields ? "Hide" : "Show"}</button></div>{passwordError && <small className="password-field-error" role="alert">{passwordError}</small>}</label><button className="primary-button profile-save-button" disabled={saving}>Change password</button></form>}
                    {profileTab === "privacy" && <div className="profile-panel"><h3>Privacy and data</h3><p>Your profile information is stored in the museum portal database and is used to manage bookings, recommendations, and reviews.</p><button type="button" className="profile-danger" onClick={onLogout}>Sign out of this device</button></div>}
                </div></div>
            </section>}
            {section === "reviews" && <section className="portal-content"><div className="section-heading"><div><p className="eyebrow">Share your perspective</p><h2>Museum reviews</h2></div></div><form className="profile-card review-form" onSubmit={submitReview}><select value={reviewForm.museumId} onChange={(event) => setReviewForm({ ...reviewForm, museumId: event.target.value })} required><option value="">Choose a museum</option>{museums.map((museum) => <option key={museum.id} value={museum.id}>{museum.name}</option>)}</select><select value={reviewForm.rating} onChange={(event) => setReviewForm({ ...reviewForm, rating: event.target.value })}><option value="5">★★★★★</option><option value="4">★★★★☆</option><option value="3">★★★☆☆</option><option value="2">★★☆☆☆</option><option value="1">★☆☆☆☆</option></select><textarea value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} placeholder="Tell visitors what you thought..." required /><button className="primary-button">Publish review</button></form>{reviews.map((review) => <article className="review-card" key={review.id}><strong>{review.museumName} · {"★".repeat(review.rating)}</strong><p>{review.comment}</p></article>)}</section>}
            {section === "admin" && user?.role === "ADMIN" && <section className="portal-content"><div className="section-heading"><div><p className="eyebrow">Operations</p><h2>Portal overview</h2></div></div><div className="stats-grid">{[["Users", adminStats?.users], ["Museums", adminStats?.museums], ["Exhibitions", adminStats?.exhibitions], ["Tickets", adminStats?.tickets], ["Revenue", `$${Number(adminStats?.revenue || 0).toFixed(2)}`]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value ?? "—"}</strong></article>)}</div><p className="admin-note">Use the Oracle database to manage records. Visitor-facing status changes and booking/payment integrity are enforced by the API.</p></section>}
            {selectedExhibition && <div className="modal-backdrop"><form className="booking-modal" onSubmit={bookTicket}><button type="button" className="modal-close" onClick={() => setSelectedExhibition(null)}>×</button><p className="eyebrow">Reserve your visit</p><h2>{selectedExhibition.title}</h2><p>{selectedExhibition.museumName} · ${Number(selectedExhibition.ticketPrice || 0).toFixed(2)}</p><label htmlFor="visit-date">Choose a date</label><input id="visit-date" type="date" min={selectedExhibition.startDate > getTodayDate() ? selectedExhibition.startDate : getTodayDate()} max={selectedExhibition.endDate} value={visitDate} onChange={(event) => setVisitDate(event.target.value)} required /><button className="primary-button" disabled={selectedExhibition.endDate < getTodayDate()}>Confirm & pay →</button>{selectedExhibition.endDate < getTodayDate() ? <small>This exhibition has ended and cannot be booked.</small> : <small>Choose an upcoming date during the exhibition. Demo payment is processed securely by the server.</small>}</form></div>}
        </main>
    );
}

export default Dashboard;
