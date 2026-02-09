import { login, signup } from "./actions";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form className="w-full max-w-md space-y-4 rounded-lg bg-white p-8 shadow">
        <h2 className="text-2xl font-bold text-center">Connexion / Inscription</h2>
        
        <div className="flex flex-col gap-2">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="border p-2 rounded" />
        </div>
        
        <div className="flex flex-col gap-2">
          <label htmlFor="password">Mot de passe</label>
          <input id="password" name="password" type="password" required className="border p-2 rounded" />
        </div>

        <div className="flex gap-4 pt-4">
          <button formAction={login} className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
            Se connecter
          </button>
          <button formAction={signup} className="flex-1 bg-gray-200 text-gray-900 p-2 rounded hover:bg-gray-300">
            S'inscrire
          </button>
        </div>
      </form>
    </div>
  );
}
