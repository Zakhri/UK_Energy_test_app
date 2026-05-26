import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

import type { CacheEntry, CacheKey, CacheRepository, IteratedEntry } from './cache.repository.js';

export interface DynamoCacheOptions {
  readonly tableName: string;
  readonly endpoint?: string;
  readonly region?: string;
}

interface StoredItem {
  PK: string;
  SK: string;
  value: unknown;
  fetchedAt: number;
  expiresAt: number;
}

export class DynamoCacheRepository implements CacheRepository {
  private readonly client: DynamoDBDocumentClient;

  constructor(private readonly options: DynamoCacheOptions) {
    const baseClient = new DynamoDBClient({
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      ...(options.region ? { region: options.region } : {}),
    });
    this.client = DynamoDBDocumentClient.from(baseClient, {
      marshallOptions: { removeUndefinedValues: true, convertEmptyValues: false },
    });
  }

  async get<T>(key: CacheKey): Promise<CacheEntry<T> | null> {
    const item = await this.fetchItem(key);
    if (!item) return null;
    if (item.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return { value: item.value as T, fetchedAt: item.fetchedAt, expiresAt: item.expiresAt };
  }

  async put<T>(key: CacheKey, value: T, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    const item: StoredItem = {
      PK: key.pk,
      SK: key.sk,
      value,
      fetchedAt: now,
      expiresAt: Math.floor(now / 1000) + ttlSeconds,
    };
    await this.client.send(new PutCommand({ TableName: this.options.tableName, Item: item }));
  }

  async getStale<T>(key: CacheKey, maxStaleSeconds: number): Promise<CacheEntry<T> | null> {
    const item = await this.fetchItem(key);
    if (!item) return null;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiredFor = nowSeconds - item.expiresAt;
    if (expiredFor > maxStaleSeconds) return null;
    return { value: item.value as T, fetchedAt: item.fetchedAt, expiresAt: item.expiresAt };
  }

  async delete(key: CacheKey): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.options.tableName,
        Key: { PK: key.pk, SK: key.sk },
      }),
    );
  }

  async iterate<T>(pkPrefix: string): Promise<readonly IteratedEntry<T>[]> {
    const items: IteratedEntry<T>[] = [];
    const nowSeconds = Math.floor(Date.now() / 1000);
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.client.send(
        new ScanCommand({
          TableName: this.options.tableName,
          FilterExpression: 'begins_with(PK, :prefix) AND expiresAt > :now',
          ExpressionAttributeValues: { ':prefix': pkPrefix, ':now': nowSeconds },
          ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
        }),
      );
      for (const raw of result.Items ?? []) {
        const stored = raw as StoredItem;
        items.push({
          key: { pk: stored.PK, sk: stored.SK },
          value: stored.value as T,
          fetchedAt: stored.fetchedAt,
          expiresAt: stored.expiresAt,
        });
      }
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  private async fetchItem(key: CacheKey): Promise<StoredItem | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.options.tableName,
        Key: { PK: key.pk, SK: key.sk },
      }),
    );
    return (result.Item as StoredItem | undefined) ?? null;
  }
}
