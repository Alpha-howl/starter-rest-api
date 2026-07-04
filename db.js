/**
 * db.js - Drop-in replacement for cyclic-dynamodb using MongoDB.
 * 
 * Exposes the same API:
 *   db.collection("Name").get(key)    → { key, collection, props } | null
 *   db.collection("Name").set(key, data) → { key, collection, props }
 *   db.collection("Name").delete(key) → truthy on success, falsy on failure
 *   db.collection("Name").list()      → { results: [{ key }, ...] }
 * 
 * Requires MONGODB_URI environment variable.
 */

const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set");
}

const client = new MongoClient(MONGODB_URI);
let dbInstance = null;
let connectionPromise = null;

async function getDb() {
    if (dbInstance) return dbInstance;
    if (!connectionPromise) {
        connectionPromise = client.connect().then(() => {
            dbInstance = client.db(); // uses the database name from the URI
            return dbInstance;
        });
    }
    return connectionPromise;
}

// Set up TTL index on collections that use it (runs once per collection)
const ttlIndexCreated = new Set();
async function ensureTtlIndex(mongoCollection, collectionName) {
    if (ttlIndexCreated.has(collectionName)) return;
    try {
        await mongoCollection.createIndex(
            { _ttlExpireAt: 1 },
            { expireAfterSeconds: 0 }
        );
    } catch (e) {
        // Index may already exist — that's fine
    }
    ttlIndexCreated.add(collectionName);
}

function collection(collectionName) {
    return {
        /**
         * Get a document by key.
         * Returns { key, collection, props } or null if not found.
         */
        async get(key) {
            const db = await getDb();
            const col = db.collection(collectionName);
            const doc = await col.findOne({ _id: key });
            if (!doc) return null;

            // Build props: everything except _id and _ttlExpireAt
            const { _id, _ttlExpireAt, ...props } = doc;
            return {
                key: _id,
                collection: collectionName,
                props
            };
        },

        /**
         * Create or update a document (upsert).
         * Returns { key, collection, props }.
         */
        async set(key, data) {
            const db = await getDb();
            const col = db.collection(collectionName);
            await ensureTtlIndex(col, collectionName);

            // Add created/updated timestamps like cyclic-dynamodb did
            const now = new Date().toISOString();
            const existing = await col.findOne({ _id: key });

            const docToSave = { ...data };

            // Add timestamps (the original code deletes these before re-saving,
            // so they'll be re-added fresh each time — matching cyclic behavior)
            if (!existing) {
                docToSave.created = now;
            } else {
                docToSave.created = existing.created || now;
            }
            docToSave.updated = now;

            // If the data has a ttl field (Unix seconds), convert to a Date for MongoDB TTL index
            if (typeof docToSave.ttl === "number") {
                docToSave._ttlExpireAt = new Date(docToSave.ttl * 1000);
            }

            await col.updateOne(
                { _id: key },
                { $set: { _id: key, ...docToSave } },
                { upsert: true }
            );

            // Return in the same format as cyclic-dynamodb
            const { _ttlExpireAt, ...props } = docToSave;
            return {
                key,
                collection: collectionName,
                props
            };
        },

        /**
         * Delete a document by key.
         * Returns truthy on success, falsy if not found.
         */
        async delete(key) {
            const db = await getDb();
            const col = db.collection(collectionName);
            const result = await col.deleteOne({ _id: key });
            return result.deletedCount > 0;
        },

        /**
         * List all document keys in the collection.
         * Returns { results: [{ key: "..." }, ...] }
         */
        async list() {
            const db = await getDb();
            const col = db.collection(collectionName);
            const docs = await col.find({}, { projection: { _id: 1 } }).toArray();
            return {
                results: docs.map(doc => ({ key: doc._id }))
            };
        }
    };
}

module.exports = { collection };
