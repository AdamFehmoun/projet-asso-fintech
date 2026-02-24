export default function PendingPage() {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center p-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
  
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Demande en attente
          </h1>
  
          <p className="text-gray-500 mb-8">
            Ta demande d'adhésion a bien été envoyée. Un admin de l'association
            doit valider ton accès avant que tu puisses accéder au dashboard.
          </p>
  
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-700">
            Tu recevras une notification dès que ton accès sera activé.
          </div>
  
          <form action="/auth/signout" method="post" className="mt-8">
            <button
              type="submit"
              className="text-sm text-gray-400 hover:text-gray-600 underline"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    )
  }