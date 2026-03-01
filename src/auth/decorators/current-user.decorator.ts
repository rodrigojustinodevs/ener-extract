import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

export type CurrentUserPayload = {
  userId: number;
  email: string;
};

/**
 * Injeta o usuário autenticado (req.user) no parâmetro do handler.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: CurrentUserPayload }>();
    return request.user;
  },
);
