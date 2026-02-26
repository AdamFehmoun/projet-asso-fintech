import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase-middleware'

// Routes publiques
const PUBLIC_ROUTES = ['/login', '/signup', '/', '/auth']

export async function middleware(request: NextRequest) {
  // 1. Rafraîchit la session et récupère la réponse (avec les cookies à jour)
  const { response, user } = await updateSession(request)

  const pathname = request.nextUrl.pathname

  // 2. Si c'est une route publique, on laisse passer
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith('/auth'))) {
    // Si l'utilisateur est déjà connecté et va sur /login, on le redirige
    if (user && (pathname === '/login' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
    return response
  }

  // 3. Si l'utilisateur n'est pas connecté sur une route protégée -> redirect /login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 4. Connecté : on le laisse entrer.
  // La vérification spécifique du "membership" se fera dans le layout de l'org.
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}