import { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:5000/api/auth";

const emptyRegistration = {
    name: "", email: "", phone: "", birthDate: "", city: "", country: "",
    password: "", confirmPassword: "", interests: "", newsletter: false,
};

function Auth({ onLoginSuccess }) {
    const [mode, setMode] = useState("login");
    const [poster, setPoster] = useState(0);
    const [role, setRole] = useState("USER");
    const [form, setForm] = useState({ ...emptyRegistration, museumName: "", location: "", museumDescription: "" });
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState({ type: "", message: "" });
    const [busy, setBusy] = useState(false);
    const posters = [
        ["Quiet forms, loud ideas.", "Sculpture / 04", "poster-sculpture"],
        ["Light finds its way in.", "Modern collection / 12", "poster-light"],
        ["A room for the unexpected.", "Contemporary / 18", "poster-forms"],
        ["History, held in colour.", "Archive / 27", "poster-colour"],
    ];

    useEffect(() => {
        const timer = window.setInterval(() => setPoster((current) => (current + 1) % posters.length), 5200);
        return () => window.clearInterval(timer);
    }, [posters.length]);

    const passwordScore = useMemo(() => [
        form.password.length >= 8, /[A-Z]/.test(form.password),
        /[0-9]/.test(form.password), /[^A-Za-z0-9]/.test(form.password),
    ].filter(Boolean).length, [form.password]);

    const update = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
        setStatus({ type: "", message: "" });
    };

    const submit = async (event) => {
        event.preventDefault();
        if (mode === "register" && (form.password !== form.confirmPassword || passwordScore < 3)) {
            setStatus({ type: "error", message: form.password !== form.confirmPassword ? "Passwords do not match." : "Use 8+ characters with a capital, number, and symbol." });
            return;
        }
        setBusy(true);
        setStatus({ type: "", message: "" });
        try {
            const endpoint = mode === "login" ? "/login" : mode === "museum" ? "/register-museum" : "/register";
            const body = mode === "login" ? { email: form.email, password: form.password, role } : form;
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Something went wrong.");
            if (mode === "register") {
                sessionStorage.removeItem("museumToken");
                sessionStorage.removeItem("museumUser");
                localStorage.setItem("museumToken", data.token);
                localStorage.setItem("museumUser", JSON.stringify(data.user));
                onLoginSuccess(data.user);
            } else {
                const storage = remember ? localStorage : sessionStorage;
                const otherStorage = remember ? sessionStorage : localStorage;
                otherStorage.removeItem("museumToken");
                otherStorage.removeItem("museumUser");
                storage.setItem("museumToken", data.token);
                storage.setItem("museumUser", JSON.stringify(data.user));
                onLoginSuccess(data.user);
            }
        } catch (error) {
            setStatus({ type: "error", message: error.message || "The museum desk is temporarily unavailable." });
        } finally { setBusy(false); }
    };

    return (
        <main className="auth-shell">
            <section className="auth-art">
                <div className="poster-slides" aria-label="Featured artwork">
                    {posters.map(([title, meta, className], index) => <div className={`poster-slide ${className} ${poster === index ? "visible" : ""}`} key={title}>
                        <div className="poster-shape poster-shape-one" /><div className="poster-shape poster-shape-two" /><div className="poster-shape poster-shape-three" />
                        <div className="poster-caption"><span>{meta}</span><strong>{title}</strong></div>
                    </div>)}
                </div>
                <div className="auth-art-top"><div className="auth-brand"><span>M</span> MUSEUM / 24</div><span className="poster-count">{String(poster + 1).padStart(2, "0")} / {String(posters.length).padStart(2, "0")}</span></div>
                <div className="poster-controls">{posters.map(([title], index) => <button aria-label={`Show artwork ${index + 1}: ${title}`} className={poster === index ? "active" : ""} key={title} onClick={() => setPoster(index)} />)}</div>
                <div className="auth-art-footer">Member access · Since 1924</div>
            </section>
            <section className="auth-panel">
                <div className="auth-card">
                    <div className="auth-switch"><button className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setStatus({ type: "", message: "" }); }}>Sign in</button><button className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setStatus({ type: "", message: "" }); }}>Create account</button><button className={mode === "museum" ? "selected" : ""} onClick={() => { setMode("museum"); setStatus({ type: "", message: "" }); }}>Register museum</button></div>
                    <p className="eyebrow">{mode === "login" ? "Welcome back" : "Join the archive"}</p>
                    <h2>{mode === "login" ? "Return to the archive." : mode === "museum" ? "Bring your museum online." : "Make your next visit memorable."}</h2>
                    <p className="auth-intro">{mode === "login" ? "Choose your access and continue exploring the collection." : mode === "museum" ? "Create a scoped manager account for your museum, exhibitions, artworks, and visit dates." : "Tell us a little about you so we can make bookings and visits effortless."}</p>
                    <form onSubmit={submit}>
                        {mode === "login" ? <>
                            <div className="auth-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" autoComplete="email" required /></div>
                            <div className="auth-field"><label htmlFor="password">Password</label><div className="password-wrap"><input id="password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={update} placeholder="Enter your password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div></div>
                            <div className="auth-options"><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Keep me signed in</label><button type="button">Forgot password?</button></div>
                        </> : mode === "museum" ? <>
                            <div className="auth-field"><label htmlFor="name">Manager name</label><input id="name" name="name" value={form.name} onChange={update} placeholder="Museum director" required /></div>
                            <div className="auth-field"><label htmlFor="museumName">Museum name</label><input id="museumName" name="museumName" value={form.museumName} onChange={update} placeholder="The Modern House" required /></div>
                            <div className="auth-field"><label htmlFor="location">Museum location</label><input id="location" name="location" value={form.location} onChange={update} placeholder="Dhaka, Bangladesh" required /></div>
                            <div className="auth-field"><label htmlFor="museumDescription">About the museum</label><textarea id="museumDescription" name="museumDescription" value={form.museumDescription} onChange={update} placeholder="Tell visitors what makes your museum special." rows="3" /></div>
                            <div className="auth-field"><label htmlFor="email">Manager email</label><input id="email" name="email" type="email" value={form.email} onChange={update} required /></div>
                            <div className="auth-field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" value={form.password} onChange={update} required /></div>
                        </> : <>
                            <div className="auth-form-grid"><div className="auth-field"><label htmlFor="name">Full name</label><input id="name" name="name" value={form.name} onChange={update} placeholder="Ada Lovelace" autoComplete="name" required /></div><div className="auth-field"><label htmlFor="phone">Phone number</label><input id="phone" name="phone" type="tel" value={form.phone} onChange={update} placeholder="+880 1..." autoComplete="tel" /></div></div>
                            <div className="auth-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" autoComplete="email" required /></div>
                            <div className="auth-form-grid"><div className="auth-field"><label htmlFor="birthDate">Date of birth</label><input id="birthDate" name="birthDate" type="date" value={form.birthDate} onChange={update} /></div><div className="auth-field"><label htmlFor="city">City</label><input id="city" name="city" value={form.city} onChange={update} placeholder="Dhaka" autoComplete="address-level2" /></div></div>
                            <div className="auth-field"><label htmlFor="country">Country</label><input id="country" name="country" value={form.country} onChange={update} placeholder="Bangladesh" autoComplete="country-name" /></div>
                            <div className="auth-field"><label htmlFor="interests">Art interests <span>(optional)</span></label><input id="interests" name="interests" value={form.interests} onChange={update} placeholder="Modern art, sculpture, history..." /></div>
                            <div className="auth-field"><label htmlFor="password">Password</label><div className="password-wrap"><input id="password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={update} placeholder="Create a strong password" autoComplete="new-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Hide" : "Show"}</button></div><div className="password-meter">{[0, 1, 2, 3].map((item) => <i className={item < passwordScore ? "active" : ""} key={item} />)}</div></div>
                            <div className="auth-field"><label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={update} placeholder="Repeat your password" required /></div>
                            <label className="consent"><input type="checkbox" name="newsletter" checked={form.newsletter} onChange={update} /> Send me exhibition announcements and visit ideas.</label>
                        </>}
                        <button className="auth-submit" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Enter the museum →" : "Create my account →"}</button>
                        <p className={`auth-status ${status.type}`} role="status">{status.message}</p>
                    </form>
                    {mode === "login" && <div className="login-access">
                        <div className="login-divider"><span>Or continue as</span></div>
                        <div className="login-role-row">
                            {[["USER", "Visitor", "◌"], ["MUSEUM_MANAGER", "Museum", "▦"], ["STAFF", "Staff", "✦"], ["ADMIN", "Admin", "⌂"]].map(([value, label, icon]) => <button type="button" className={role === value ? "selected" : ""} key={value} onClick={() => setRole(value)}><span>{icon}</span><strong>{label}</strong></button>)}
                        </div>
                        <p className="login-role-hint">You are signing in as <strong>{role === "USER" ? "a visitor" : role.toLowerCase()}</strong>.</p>
                    </div>}
                </div>
            </section>
        </main>
    );
}

export default Auth;
