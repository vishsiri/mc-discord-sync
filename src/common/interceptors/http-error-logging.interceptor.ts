import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class HttpErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpErrorLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
    }>();

    return next.handle().pipe(
      catchError((error: unknown) => {
        const status =
          error instanceof HttpException ? error.getStatus() : 500;

        if (status >= 500) {
          const method = request?.method ?? 'UNKNOWN_METHOD';
          const url = request?.originalUrl ?? request?.url ?? 'UNKNOWN_URL';
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown internal server error';
          const stack = error instanceof Error ? error.stack : undefined;

          this.logger.error(
            `[HTTP ${status}] ${method} ${url} - ${message}`,
            stack,
          );
        }

        return throwError(() => error);
      }),
    );
  }
}