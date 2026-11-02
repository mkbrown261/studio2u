import sqlite3
import tempfile
from pathlib import Path

db=sqlite3.connect(':memory:');db.execute('PRAGMA foreign_keys=ON');db.executescript('CREATE TABLE users(id INTEGER PRIMARY KEY);INSERT INTO users VALUES(1);')
db.executescript(Path('migrations/0018_label_world.sql').read_text())
for label in ['a','b']:db.execute('INSERT INTO lw_labels(id,name) VALUES(?,?)',(label,label))
db.execute("INSERT INTO lw_releases(id,label_id,artist,title,release_type) VALUES('legacy','a','Artist','Legacy draft','single')")
db.executescript(Path('migrations/0019_label_world_release_operations.sql').read_text())
assert db.execute('SELECT title,release_mode,workflow_state FROM lw_releases').fetchone()==('Legacy draft','FAST_RELEASE','INTAKE_PENDING')
assert db.execute('SELECT count(*) FROM lw_registration_tasks').fetchone()[0]==4

def reject(sql):
 try:db.execute(sql)
 except sqlite3.IntegrityError:return
 raise AssertionError('Invalid reference/status accepted: '+sql)

reject("INSERT INTO lw_registration_tasks(id,label_id,release_id,organization) VALUES('bad','b','legacy','PRO')")
reject("INSERT INTO lw_registration_tasks(id,label_id,release_id,organization) VALUES('dup','a','legacy','PRO')")
reject("UPDATE lw_registration_tasks SET status='CONFIRMED'")
reject("INSERT INTO lw_rights_reviews VALUES('r','b','legacy',1,'{}',1,CURRENT_TIMESTAMP)")
reject("INSERT INTO lw_audit_events VALUES('e','b','legacy',1,'x','{}',CURRENT_TIMESTAMP)")
print('PASS: additive migration preserves old drafts, backfills four independent follow-ups, cross-tenant foreign keys, uniqueness and no fabricated official confirmation')

db.commit()
# A separate client/process can reopen the saved database without losing follow-ups.
with tempfile.TemporaryDirectory() as directory:
 path=Path(directory)/'persisted.sqlite'
 disk=sqlite3.connect(path);db.backup(disk);disk.close()
 reopened=sqlite3.connect(path)
 assert reopened.execute('SELECT count(*) FROM lw_registration_tasks').fetchone()[0]==4
 assert reopened.execute("SELECT count(*) FROM lw_registration_tasks WHERE status='PENDING'").fetchone()[0]==4
 reopened.close()
print('PASS: registration queue survives database close/reopen with no streams or browser dependency')
