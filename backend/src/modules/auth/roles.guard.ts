import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export const Roles = (...roles: Array<'user' | 'admin'>) => SetMetadata('roles', roles);
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly reflector = new Reflector();
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [context.getHandler(), context.getClass()]);
    const user = context.switchToHttp().getRequest().user;
    if (!user) throw new UnauthorizedException('Inicia sesión para continuar.');
    if (roles && !roles.includes(user.role || 'user')) throw new ForbiddenException('No tienes permiso para esta operación.');
    return true;
  }
}
