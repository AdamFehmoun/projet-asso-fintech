import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase-middleware' // On créera ce fichier juste après

export async function middleware(request: NextRequest) {
  // Pour l'instant, on laisse passer tout le monde le temps de configurer
  // return await updateSession(request)
  return; 
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
