import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AuditProgressEvent } from '@webaudit/shared';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
  namespace: '/audits',
})
export class AuditsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AuditsGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-audit')
  subscribeToAudit(
    @MessageBody() data: { auditId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`audit:${data.auditId}`);
    this.logger.debug(`Client ${client.id} subscribed to audit:${data.auditId}`);
    return { event: 'subscribed', auditId: data.auditId };
  }

  @SubscribeMessage('unsubscribe-audit')
  unsubscribeFromAudit(
    @MessageBody() data: { auditId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`audit:${data.auditId}`);
  }

  // Called by workers to emit progress events
  emitProgress(event: AuditProgressEvent) {
    this.server.to(`audit:${event.auditId}`).emit('audit:progress', event);
  }

  emitComplete(auditId: string, scores: any) {
    this.server.to(`audit:${auditId}`).emit('audit:complete', { auditId, scores });
  }

  emitError(auditId: string, error: string) {
    this.server.to(`audit:${auditId}`).emit('audit:error', { auditId, error });
  }
}
