import { DatabaseSync } from 'node:sqlite'
import { readFileSync, existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
registerHooks({ resolve(specifier,context,nextResolve){try{return nextResolve(specifier,context)}catch(error){if(specifier.startsWith('.')){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(fileURLToPath(url)))return nextResolve(url.href,context)}throw error}} })
const { Hono }=await import('hono'),{ csrf }=await import('hono/csrf'),{ labelWorldRoutes }=await import('../src/routes/label-world.ts')
export function fixture(path=':memory:'){
 const sqlite=new DatabaseSync(path);if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE name='users'").get()){sqlite.exec(`PRAGMA foreign_keys=ON;CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,name TEXT,phone TEXT,is_engineer INTEGER,is_artist INTEGER,is_platform_admin INTEGER);CREATE TABLE sessions(token TEXT,user_id INTEGER,expires_at TEXT);`)
 for(let i=1;i<=4;i++){sqlite.prepare('INSERT INTO users VALUES (?,?,?,NULL,0,1,0)').run(i,`test${i}@example.invalid`,`Test ${i}`);sqlite.prepare('INSERT INTO sessions VALUES (?,?,?)').run(`test-session-${i}`,i,'2099-01-01 00:00:00')}
 sqlite.exec(readFileSync('migrations/0018_label_world.sql','utf8'));sqlite.exec(readFileSync('migrations/0019_label_world_release_operations.sql','utf8'));sqlite.exec(readFileSync('migrations/0020_label_world_reasoning.sql','utf8'));sqlite.exec(readFileSync('migrations/0021_label_world_workspace.sql','utf8'));sqlite.exec(readFileSync('migrations/0022_label_world_reviews.sql','utf8'));sqlite.exec(readFileSync('migrations/0023_label_world_research_sources.sql','utf8'));sqlite.exec(readFileSync('migrations/0024_label_world_context.sql','utf8'));sqlite.exec(readFileSync('migrations/0025_label_world_mcp.sql','utf8'));sqlite.exec(readFileSync('migrations/0026_label_world_autonomy.sql','utf8'));sqlite.exec(readFileSync('migrations/0027_label_world_playbooks.sql','utf8'));sqlite.exec(readFileSync('migrations/0028_label_world_social_snapshots.sql','utf8'));sqlite.exec(readFileSync('migrations/0029_label_world_office.sql','utf8'));sqlite.exec(readFileSync('migrations/0030_label_world_ascap_works.sql','utf8'));sqlite.exec(readFileSync('migrations/0031_label_world_outreach.sql','utf8'))
 }
 class Statement{
  constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new Statement(this.sql,args)}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.args),success:true}}
  async run(){const result=sqlite.prepare(this.sql).run(...this.args);return {success:true,results:[],meta:{changes:Number(result.changes)}}}
 }
 const db={prepare(sql){return new Statement(sql)},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}}
 const app=new Hono();app.use(csrf());app.route('/',labelWorldRoutes);app.onError(error=>error.getResponse ? error.getResponse() : new Response(JSON.stringify({error:'Request failed'}),{status:500,headers:{'content-type':'application/json'}}))
 return {sqlite,db,app,env:{DB:db}}
}
