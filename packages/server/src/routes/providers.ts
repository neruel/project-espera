import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ValidateProviderCredentialSchema } from '@espera/shared';
import type { ProviderRegistry } from '../providers/registry.js';
import { maskApiKey } from '../security/crypto.js';
import { ProviderError } from '../providers/http.js';
export function createProviderRoutes(registry:ProviderRegistry){const r=new Hono();
 r.get('/',async c=>c.json({providers:await Promise.all(registry.list().map(async p=>({id:p.id,name:p.name,defaultBaseUrl:p.defaultBaseUrl,models:p.id==='mock'?await p.listModels():[],capabilities:p.getCapabilities()})))}));
 r.post('/models',async c=>{try{const b:any=await c.req.json();if(!b.providerId||(!b.credential?.apiKey&&b.providerId!=='mock'))return c.json({error:{code:'invalid_credential',message:'API Key가 필요합니다.'}},400);const models=await registry.get(b.providerId).listModels(b.credential);return c.json({models});}catch(e){const x=e as any;return c.json({error:{code:x.code||'provider_unavailable',message:x.message||'모델 목록을 불러오지 못했습니다.'}},(x.status||502) as ContentfulStatusCode)}});
 r.post('/validate',async c=>{const parsed=ValidateProviderCredentialSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:'Validation failed',details:parsed.error.flatten()},400);try{const {providerId,credential}=parsed.data;const isValid=await registry.get(providerId).validateCredential(credential);return c.json({providerId,isValid,maskedKey:maskApiKey(credential.apiKey),testedAt:new Date().toISOString()});}catch(e){const x=e as ProviderError;return c.json({error:{code:x.code||'unknown_error',message:x.message}},(x.status||502) as ContentfulStatusCode)}});
 return r;}
