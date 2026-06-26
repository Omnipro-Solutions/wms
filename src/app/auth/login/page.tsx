import { APP_CONFIG } from '@/config/app-config'
import { LoginForm } from '../_components/login-form'

export default function LoginPage() {
  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-87.5">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-medium">Ingresa a tu cuenta</h1>
          <p className="text-muted-foreground text-sm">Ingresa tus datos para continuar.</p>
        </div>
        <LoginForm />
      </div>

      <div className="absolute bottom-5 flex w-full justify-between px-10">
        <div className="text-sm">{APP_CONFIG.copyright}</div>
        <div className="text-muted-foreground text-sm">WMS v{APP_CONFIG.version}</div>
      </div>
    </>
  )
}
