import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureHttp } from '../src/common/http-security';
import { ApiExceptionFilter } from '../src/common/api-exception.filter';
import { httpRequest } from './http-helper';

@Controller() class SampleController {
  @Get('sample') sample() { return { text: 'music '.repeat(1000) }; }
  @Post('sample') post(@Body() body: any) { return body; }
}
@Module({ controllers: [SampleController] }) class SampleModule {}
test('HTTP: helmet, HSTS según entorno, compresión y límite JSON', async () => {
  for (const production of [false, true]) {
    const app = await NestFactory.create(SampleModule, { logger: false, bodyParser: false });
    configureHttp(app, production);
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    try {
      const request = httpRequest(app);
      const res = await request('/sample');
      assert.equal(res.headers.get('x-powered-by'), null);
      assert.match(res.headers.get('content-security-policy')!, /default-src 'none'/);
      assert.match(res.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
      assert.equal(!!res.headers.get('strict-transport-security'), production);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      const compressed = await request('/sample', 'GET', undefined, undefined, { 'Accept-Encoding': 'gzip' });
      assert.equal(compressed.headers.get('content-encoding'), 'gzip');
      assert.equal((await request('/sample', 'POST', { text: 'x'.repeat(11000) })).status, 413);
    } finally { await app.close(); }
  }
});
