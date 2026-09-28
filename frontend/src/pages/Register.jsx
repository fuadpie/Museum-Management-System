import { useMemo, useState } from "react";

const initialForm = {
	name: "",
	email: "",
	password: "",
	confirmPassword: "",
};

function Register({ onGoToLogin }) {
	const [form, setForm] = useState(initialForm);
	const [showPassword, setShowPassword] = useState(false);
	const [status, setStatus] = useState({ type: "", message: "" });
	const [isSubmitting, setIsSubmitting] = useState(false);

	const passwordScore = useMemo(() => {
		const { password } = form;
		return [
			password.length >= 8,
			/[A-Z]/.test(password),
			/[0-9]/.test(password),
			/[^A-Za-z0-9]/.test(password),
		].filter(Boolean).length;
	}, [form]);

	const updateField = (event) => {
		const { name, value } = event.target;
		setForm((currentForm) => ({ ...currentForm, [name]: value }));
		setStatus({ type: "", message: "" });
	};

	const handleSubmit = async (event) => {
		event.preventDefault();

		if (form.password !== form.confirmPassword) {
			setStatus({ type: "error", message: "Passwords do not match." });
			return;
		}

		if (passwordScore < 3) {
			setStatus({
				type: "error",
				message: "Choose a stronger password before continuing.",
			});
			return;
		}

		setIsSubmitting(true);
		setStatus({ type: "", message: "" });

		try {
			const response = await fetch("http://localhost:5000/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: form.name,
					email: form.email,
					password: form.password,
				}),
			});
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || "We could not create your account.");
			}

			setForm(initialForm);
			setStatus({
				type: "success",
				message: "Account created. Welcome to the museum.",
			});
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
		<main className="register-page">
			<style>{`
				:root {
					--ink: #1d2723;
					--muted: #718078;
					--paper: #f4f1e9;
					--card: #fffdf8;
					--line: #d8ded5;
					--fern: #47695b;
					--fern-dark: #2e4f43;
					--coral: #db765d;
				}

				* { box-sizing: border-box; }

				.register-page {
					min-height: 100svh;
					display: grid;
					grid-template-columns: minmax(280px, 0.9fr) minmax(420px, 1.1fr);
					overflow: hidden;
					color: var(--ink);
					background: var(--paper);
					font-family: "Trebuchet MS", "Segoe UI", sans-serif;
					text-align: left;
				}

				.register-art {
					position: relative;
					display: flex;
					flex-direction: column;
					justify-content: space-between;
					min-height: 100%;
					padding: clamp(28px, 5vw, 70px);
					overflow: hidden;
					color: #f6f3e9;
					background: var(--fern-dark);
					isolation: isolate;
				}

				.register-art::before {
					content: "";
					position: absolute;
					inset: 0;
					z-index: -1;
					opacity: 0.28;
					background-image: linear-gradient(135deg, transparent 48%, rgba(255,255,255,.2) 49%, transparent 51%), linear-gradient(45deg, transparent 48%, rgba(255,255,255,.13) 49%, transparent 51%);
					background-size: 84px 84px;
				}

				.register-art::after {
					content: "";
					position: absolute;
					right: -25%;
					bottom: -16%;
					z-index: -1;
					width: 78%;
					aspect-ratio: 1;
					border: 1px solid rgba(255,255,255,.23);
					border-radius: 50%;
					box-shadow: 0 0 0 38px rgba(255,255,255,.04), 0 0 0 76px rgba(255,255,255,.035), 0 0 0 114px rgba(255,255,255,.03);
				}

				.brand-mark { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
				.brand-mark span { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid rgba(255,255,255,.7); border-radius: 50%; font-family: Georgia, serif; font-size: 19px; font-weight: 400; letter-spacing: 0; }
				.art-copy { max-width: 440px; margin-top: auto; padding-top: 18vh; }
				.art-kicker, .form-kicker { color: var(--coral); font-size: 12px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
				.art-copy h1 { max-width: 520px; margin: 20px 0; color: #fffdf5; font-family: Georgia, "Times New Roman", serif; font-size: clamp(42px, 5.5vw, 78px); font-weight: 400; line-height: .98; letter-spacing: -.04em; }
				.art-copy p { max-width: 340px; color: rgba(246,243,233,.72); font-size: 15px; line-height: 1.7; }
				.art-footer { display: flex; align-items: center; gap: 12px; color: rgba(246,243,233,.64); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
				.art-footer::before { content: ""; width: 32px; height: 1px; background: var(--coral); }

				.register-panel { display: grid; place-items: center; padding: 48px clamp(28px, 7vw, 112px); background: var(--card); }
				.register-form-wrap { width: min(100%, 480px); }
				.register-form-wrap h2 { margin: 12px 0 10px; color: var(--ink); font-family: Georgia, "Times New Roman", serif; font-size: clamp(36px, 4vw, 54px); font-weight: 400; line-height: 1; letter-spacing: -.04em; }
				.form-intro { margin-bottom: 32px; color: var(--muted); font-size: 14px; line-height: 1.6; }
				.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
				.field { display: grid; gap: 8px; margin-bottom: 17px; }
				.field label { color: var(--ink); font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
				.field input { width: 100%; min-height: 50px; border: 1px solid var(--line); border-radius: 2px; outline: none; padding: 0 15px; color: var(--ink); background: #faf9f4; font: inherit; font-size: 15px; transition: border-color .2s, box-shadow .2s, background .2s; }
				.field input:focus { border-color: var(--fern); background: white; box-shadow: 0 0 0 3px rgba(71,105,91,.12); }
				.password-input { position: relative; }
				.password-input input { padding-right: 72px; }
				.password-toggle { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); border: 0; padding: 5px; color: var(--fern-dark); background: transparent; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
				.password-meter { display: flex; gap: 4px; margin-top: 2px; }
				.password-meter i { flex: 1; height: 3px; background: var(--line); }
				.password-meter i.active { background: var(--coral); }
				.form-note { margin: -4px 0 22px; color: var(--muted); font-size: 12px; }
				.submit-button { display: flex; width: 100%; min-height: 54px; align-items: center; justify-content: space-between; border: 0; border-radius: 2px; padding: 0 19px 0 22px; color: #fffdf8; background: var(--fern); cursor: pointer; font: inherit; font-size: 14px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; transition: background .2s, transform .2s; }
				.submit-button span:last-child { font-size: 21px; font-weight: 400; }
				.submit-button:hover:not(:disabled) { background: var(--fern-dark); transform: translateY(-2px); }
				.submit-button:disabled { cursor: wait; opacity: .65; }
				.status { min-height: 22px; margin: 14px 0 0; font-size: 13px; }
				.status.error { color: #b54e3a; }
				.status.success { color: var(--fern); }
				.sign-in { margin-top: 25px; color: var(--muted); font-size: 13px; text-align: center; }
				.sign-in button { border: 0; padding: 0; color: var(--fern-dark); background: transparent; cursor: pointer; font: inherit; font-weight: 700; }

				@media (max-width: 820px) {
					.register-page { grid-template-columns: 1fr; overflow: visible; }
					.register-art { min-height: 420px; }
					.art-copy { padding-top: 70px; }
					.register-panel { padding: 52px 24px 64px; }
				}

				@media (max-width: 500px) {
					.register-art { min-height: 390px; padding: 28px 24px; }
					.art-copy h1 { font-size: 49px; }
					.form-row { grid-template-columns: 1fr; gap: 0; }
				}
			`}</style>

			<section className="register-art" aria-label="Museum introduction">
				<div className="brand-mark"><span>M</span> MUSEUM / 24</div>
				<div className="art-copy">
					<div className="art-kicker">Curate your next chapter</div>
					<h1>A place for every story.</h1>
					<p>Build a living collection of ideas, objects, and moments worth remembering.</p>
				</div>
				<div className="art-footer">Member access · Since 1924</div>
			</section>

			<section className="register-panel">
				<div className="register-form-wrap">
					<div className="form-kicker">Create your account</div>
					<h2>Join the archive.</h2>
					<p className="form-intro">Your private key to exhibitions, collections, and the stories behind them.</p>

					<form onSubmit={handleSubmit}>
						<div className="form-row">
							<div className="field">
								<label htmlFor="name">Full name</label>
								<input id="name" name="name" type="text" value={form.name} onChange={updateField} placeholder="Ada Lovelace" autoComplete="name" required />
							</div>
							<div className="field">
								<label htmlFor="email">Email address</label>
								<input id="email" name="email" type="email" value={form.email} onChange={updateField} placeholder="you@example.com" autoComplete="email" required />
							</div>
						</div>
						<div className="field">
							<label htmlFor="password">Password</label>
							<div className="password-input">
								<input id="password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={updateField} placeholder="Create a strong password" autoComplete="new-password" required />
								<button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button>
							</div>
							<div className="password-meter" aria-label={`${passwordScore} of 4 password requirements met`}>
								{[0, 1, 2, 3].map((meter) => <i className={meter < passwordScore ? "active" : ""} key={meter} />)}
							</div>
						</div>
						<div className="field">
							<label htmlFor="confirmPassword">Confirm password</label>
							<input id="confirmPassword" name="confirmPassword" type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={updateField} placeholder="Repeat your password" autoComplete="new-password" required />
						</div>
						<p className="form-note">Use 8+ characters with a number, capital letter, and symbol.</p>
						<button className="submit-button" type="submit" disabled={isSubmitting}>
							<span>{isSubmitting ? "Opening your account..." : "Create account"}</span>
							<span aria-hidden="true">→</span>
						</button>
						<p className={`status ${status.type}`} role="status">{status.message}</p>
					</form>

					<p className="sign-in">Already a member? <button type="button" onClick={onGoToLogin}>Sign in</button></p>
				</div>
			</section>
		</main>
	);
}

export default Register;
