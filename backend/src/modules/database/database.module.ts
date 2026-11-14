import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import mongoose, { Connection } from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private connection?: Connection;
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
