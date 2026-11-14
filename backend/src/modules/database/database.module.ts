import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import mongoose, { Connection } from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private connection?: Connection;
  get db() {
    if (!this.connection || this.connection.readyState !== 1) throw new ServiceUnavailableException('MongoDB no está disponible para cuentas.');
    return this.connection;
  }
  async onModuleInit() {
    const uri = process.env.MONGODB_URI?.trim();
    if (uri) this.connection = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
  }
  get status() { return !this.connection ? 'not_configured' : this.connection.readyState === 1 ? 'connected' : 'disconnected'; }
  async onModuleDestroy() { await this.connection?.close(); }
}
@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
