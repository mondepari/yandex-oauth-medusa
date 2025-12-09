import { login } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import YandexLogin from "@modules/account/components/yandex-login"
import { useActionState } from "react"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Login = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(login, null)

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center login-div"
      data-testid="login-page"
    >
      <h1 className="text-large-semi mb-8 uppercase font-unb">С возвращением</h1>
      
      <div className="w-full mb-6">
        <YandexLogin />
      </div>

      <div className="w-full flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-gray-300"></div>
        <span className="text-ui-fg-base text-small-regular text-gray-500">или</span>
        <div className="flex-1 h-px bg-gray-300"></div>
      </div>

      {/* Email/Password Form */}
      <form className="w-full login" action={formAction}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="Почта"
            name="email"
            type="email"
            title="Введите корректную почту."
            autoComplete="email"
            required
            data-testid="email-input"
          />
          <Input
            label="Пароль"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="password-input"
          />
        </div>
        <ErrorMessage error={message} data-testid="login-error-message" />
        <SubmitButton data-testid="sign-in-button" className="w-full mt-6 login-btn font-nun">
          Войти
        </SubmitButton>
      </form>
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        Нету аккаунта?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="underline"
          data-testid="register-button"
        >
          Регистрация
        </button>
        .
      </span>
    </div>
  )
}

export default Login
