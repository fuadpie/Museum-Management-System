import { useState } from "react";

const initialForm = {
	email: "",
	password: "",
};

function Login({ onGoToRegister, onLoginSuccess }) {
	const [form, setForm] = useState(initialForm);
	const [showPassword, setShowPassword] = useState(false);
	const [rememberMe, setRememberMe] = useState(false);
	const [status, setStatus] = useState({ type: "", message: "" });
	const [isSubmitting, setIsSubmitting] = useState(false);

	const updateField = (event) => {
		const { name, value } = event.target;
		setForm((currentForm) => ({ ...currentForm, [name]: value }));
		setStatus({ type: "", message: "" });
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setIsSubmitting(true);
		setStatus({ type: "", message: "" });

		try {
			const response = await fetch("http://localhost:5000/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(form),
			});
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "We could not sign you in.");
			}

			const storage = rememberMe ? localStorage : sessionStorage;
			storage.setItem("museumToken", data.token);
            storage.setItem("museumUser", JSON.stringify(data.user));

            setForm(initialForm);
            setStatus({
                type: "success",
                message: "Welcome back to the museum.",
            });

            onLoginSuccess(data.user);
		} catch (error) {
			setStatus({
				type: "error",
				message: error.message || "The museum desk is temporarily unavailable.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<main className="login-page">
			<style>{`
				:root {
					--login-ink: #1d2723;
					--login-muted: #718078;
					--login-paper: #f4f1e9;
					--login-card: #fffdf8;
					--login-line: #d8ded5;
					--login-fern: #47695b;
					--login-fern-dark: #2e4f43;
					--login-coral: #db765d;
				}

				* { box-sizing: border-box; }
				.login-page { min-height: 100svh; display: grid; grid-template-columns: minmax(420px, 1.1fr) minmax(280px, .9fr); overflow: hidden; color: var(--login-ink); background: var(--login-paper); font-family: "Trebuchet MS", "Segoe UI", sans-serif; text-align: left; }
				.login-panel { display: grid; place-items: center; padding: 48px clamp(28px, 7vw, 112px); background: var(--login-card); }
				.login-form-wrap { width: min(100%, 480px); }
				.login-kicker, .login-art-kicker { color: var(--login-coral); font-size: 12px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
				.login-form-wrap h1 { margin: 12px 0 10px; color: var(--login-ink); font-family: Georgia, "Times New Roman", serif; font-size: clamp(40px, 4vw, 58px); font-weight: 400; line-height: 1; letter-spacing: -.04em; }
				.login-intro { margin-bottom: 34px; color: var(--login-muted); font-size: 14px; line-height: 1.6; }
				.login-field { display: grid; gap: 8px; margin-bottom: 19px; }
				.login-field label { color: var(--login-ink); font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
				.login-field input { width: 100%; min-height: 52px; border: 1px solid var(--login-line); border-radius: 2px; outline: none; padding: 0 15px; color: var(--login-ink); background: #faf9f4; font: inherit; font-size: 15px; transition: border-color .2s, box-shadow .2s, background .2s; }
				.login-field input:focus { border-color: var(--login-fern); background: white; box-shadow: 0 0 0 3px rgba(71,105,91,.12); }
				.login-password { position: relative; }
				.login-password input { padding-right: 72px; }
				.login-password button { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); border: 0; padding: 5px; color: var(--login-fern-dark); background: transparent; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
				.login-options { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 25px; color: var(--login-muted); font-size: 12px; }
				.login-options label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
				.login-options input { accent-color: var(--login-fern); }
				.login-options button, .login-signup button { border: 0; padding: 0; color: var(--login-fern-dark); background: transparent; cursor: pointer; font: inherit; font-weight: 700; }
				.login-submit { display: flex; width: 100%; min-height: 54px; align-items: center; justify-content: space-between; border: 0; border-radius: 2px; padding: 0 19px 0 22px; color: #fffdf8; background: var(--login-fern); cursor: pointer; font: inherit; font-size: 14px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; transition: background .2s, transform .2s; }
				.login-submit span:last-child { font-size: 21px; font-weight: 400; }
				.login-submit:hover:not(:disabled) { background: var(--login-fern-dark); transform: translateY(-2px); }
				.login-submit:disabled { cursor: wait; opacity: .65; }
				.login-status { min-height: 22px; margin: 14px 0 0; font-size: 13px; }
				.login-status.error { color: #b54e3a; }
				.login-status.success { color: var(--login-fern); }
				.login-signup { margin-top: 26px; color: var(--login-muted); font-size: 13px; text-align: center; }
				.login-art { position: relative; display: flex; flex-direction: column; justify-content: space-between; min-height: 100%; padding: clamp(28px, 5vw, 70px); overflow: hidden; color: #f6f3e9; background: var(--login-fern-dark); isolation: isolate; }
				.login-art::before { content: ""; position: absolute; inset: 0; z-index: -1; opacity: .28; background-image: linear-gradient(135deg, transparent 48%, rgba(255,255,255,.2) 49%, transparent 51%), linear-gradient(45deg, transparent 48%, rgba(255,255,255,.13) 49%, transparent 51%); background-size: 84px 84px; }
				.login-art::after { content: ""; position: absolute; right: -25%; bottom: -16%; z-index: -1; width: 78%; aspect-ratio: 1; border: 1px solid rgba(255,255,255,.23); border-radius: 50%; box-shadow: 0 0 0 38px rgba(255,255,255,.04), 0 0 0 76px rgba(255,255,255,.035), 0 0 0 114px rgba(255,255,255,.03); }
				.login-brand { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
				.login-brand span { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid rgba(255,255,255,.7); border-radius: 50%; font-family: Georgia, serif; font-size: 19px; font-weight: 400; letter-spacing: 0; }
				.login-art-copy { max-width: 390px; margin-top: auto; padding-top: 18vh; }
				.login-art-copy h2 { max-width: 390px; margin: 20px 0; color: #fffdf5; font-family: Georgia, "Times New Roman", serif; font-size: clamp(40px, 5vw, 70px); font-weight: 400; line-height: .98; letter-spacing: -.04em; }
				.login-art-copy p { max-width: 315px; color: rgba(246,243,233,.72); font-size: 15px; line-height: 1.7; }
				.login-art-footer { display: flex; align-items: center; gap: 12px; color: rgba(246,243,233,.64); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
				.login-art-footer::before { content: ""; width: 32px; height: 1px; background: var(--login-coral); }

				@media (max-width: 820px) {
					.login-page { grid-template-columns: 1fr; overflow: visible; }
					.login-art { min-height: 390px; order: -1; }
					.login-art-copy { padding-top: 70px; }
					.login-panel { padding: 52px 24px 64px; }
				}
			`}</style>

			<section className="login-panel">
				<div className="login-form-wrap">
					<div className="login-kicker">Welcome back</div>
					<h1>Return to the archive.</h1>
					<p className="login-intro">Continue exploring the collection, exactly where you left off.</p>

					<form onSubmit={handleSubmit}>
						<div className="login-field">
							<label htmlFor="email">Email address</label>
							<input id="email" name="email" type="email" value={form.email} onChange={updateField} placeholder="you@example.com" autoComplete="email" required />
						</div>
						<div className="login-field">
							<label htmlFor="password">Password</label>
							<div className="login-password">
								<input id="password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={updateField} placeholder="Enter your password" autoComplete="current-password" required />
								<button type="button" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button>
							</div>
						</div>
						<div className="login-options">
							<label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Keep me signed in</label>
							<button type="button">Forgot password?</button>
						</div>
						<button className="login-submit" type="submit" disabled={isSubmitting}>
							<span>{isSubmitting ? "Checking your pass..." : "Enter the museum"}</span>
							<span aria-hidden="true">→</span>
						</button>
						<p className={`login-status ${status.type}`} role="status">{status.message}</p>
					</form>

							<p className="login-signup">New to the collection? <button type="button" onClick={onGoToRegister}>Create an account</button></p>
				</div>
			</section>

			<section className="login-art" aria-label="Museum introduction">
				<div className="login-brand"><span>M</span> MUSEUM / 24</div>
				<div className="login-art-copy">
					<div className="login-art-kicker">The collection awaits</div>
					<h2>Some stories are worth returning to.</h2>
					<p>Step back into a living archive of art, memory, and unexpected connections.</p>
				</div>
				<div className="login-art-footer">Member access · Since 1924</div>
			</section>
		</main>
	);
}

export default Login;
