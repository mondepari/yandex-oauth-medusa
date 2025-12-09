# Диагноз по текущему состоянию

- Токен из callback у вас содержит actor_type="customer" и auth_identity_id , но actor_id="" и нет email в user_metadata / app_metadata .
- Это приводит к 401 на GET /store/customers/me , так как токен не привязан к покупателю.
Что подтверждает Medusa MCP

- Провайдер должен возвращать success: true и authIdentity в validateCallback . Данные пользователя кладутся в authIdentity.user_metadata и authIdentity.provider_metadata . Эти поля появляются в JWT и доступны на фронте как decoded.user_metadata .
- Поток в storefront: callback → decode → если actor_id пуст → create customer (email из decoded.user_metadata.email) → sdk.auth.refresh → sdk.store.customer.retrieve .
- Помимо create / retrieve , Auth Module поддерживает обновление identity:
  - Внутри провайдера можно реализовать метод update(data, authIdentityProviderService) — он вызывает authIdentityProviderService.update(entity_id, { user_metadata, provider_metadata }) .
  - На уровне модуля есть authModuleService.updateAuthIdentities(...) и updateProviderIdentities(...) .
Почему сейчас не работает

- Ваша identity вероятно создавалась без user_metadata.email . Поэтому токен из callback не содержит email, и storefront не может создать customer .
- Ранее попытка обновить user_metadata через несуществующий метод не сработала.
Что нужно поменять на бэке (точно по доке)

- В validateCallback после успешного обмена кода и получения профиля Яндекса:
  - Если запись существует: вызвать authIdentityProviderService.update(entityId, { user_metadata: { email, ... }, provider_metadata: { access_token, refresh_token } }) .
  - Если записи нет: создать её через authIdentityProviderService.create({ entity_id: entityId, user_metadata: { email, ... }, provider_metadata: { access_token, refresh_token } }) .
- Ключевой момент — именно update / create на authIdentityProviderService , а не возвращение произвольных полей в AuthenticationResponse . JWT формируется из сохранённой identity, а не из ответного объекта.
Пример фрагмента (без комментариев):

- обновление при наличии записи:
```
const existing = await 
authIdentityProviderService.retrieve
({ entity_id: entityId })
await authIdentityProviderService.
update(entityId, {
  user_metadata: {
    email,
    name: infoJson.real_name || 
    infoJson.name || infoJson.
    display_name,
    avatar_id: infoJson.
    default_avatar_id || infoJson.
    avatar_id,
    psuid: infoJson.psuid,
    uid: infoJson.uid || infoJson.
    id,
    login: infoJson.login,
  },
  provider_metadata: {
    access_token: accessToken,
    refresh_token: refreshToken,
  },
})
```
- создание при отсутствии:
```
const authIdentity = await 
authIdentityProviderService.create({
  entity_id: entityId,
  user_metadata: { email, ... },
  provider_metadata: { 
  access_token, refresh_token },
})
return { success: true, 
authIdentity }
```
Storefront

- Оставьте поток как в доке: после callback декодируете токен и берёте email из decoded.user_metadata.email . Если actor_id === "" , создаёте customer и затем sdk.auth.refresh() .
- Если после правки бэка decoded.user_metadata.email всё равно пуст — временно используйте default_email Яндекса, который мы уже читаем в провайдере, и добавьте минимальную форму ввода email на коллбэке как резерв.
Отличия Яндекс vs Google

- У Яндекса email приходит как default_email в https://login.yandex.ru/info?format=json . Это корректно — именно его и используйте как основной email.
Итог действий

- Обновите провайдер: используйте authIdentityProviderService.update для существующей identity, и create с заполненным user_metadata / provider_metadata для новой.
- Повторите вход: после callback токен будет содержать user_metadata.email , storefront создаст customer , refresh вернёт токен с actor_id , retrieve станет 200.
Если хотите, я внесу точные исправления в service.ts , чтобы использовать authIdentityProviderService.update по доке и гарантированно класть default_email в user_metadata .
