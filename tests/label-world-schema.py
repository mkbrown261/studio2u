import sqlite3
from pathlib import Path

db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.execute('CREATE TABLE users(id INTEGER PRIMARY KEY)')
db.execute('INSERT INTO users VALUES (1)')
db.executescript(Path('migrations/0018_label_world.sql').read_text())
for label in ('a', 'b'):
    db.execute('INSERT INTO lw_labels(id,name) VALUES (?,?)', (label,label))
db.execute("INSERT INTO lw_memberships VALUES ('a',1,'owner')")
db.execute("INSERT INTO lw_releases(id,label_id,artist,title,release_type) VALUES ('r','a','Artist','Song','single')")

def reject(sql):
    try: db.execute(sql)
    except sqlite3.IntegrityError: return
    raise AssertionError('Invalid record accepted: '+sql)

reject("INSERT INTO lw_assets(id,label_id,release_id,kind,original_name,object_key,byte_size,sha256) VALUES ('x','b','r','master','song.wav','b/song',1,'hash')")
reject("INSERT INTO lw_tasks(id,label_id,release_id,agent_role) VALUES ('t','b','r','reviewer')")
reject("INSERT INTO lw_approvals(id,label_id,release_id,release_version,action,requested_by) VALUES ('p','b','r',1,'download',1)")
reject("INSERT INTO lw_memberships VALUES ('a',1,'viewer')")
reject("INSERT INTO lw_tasks(id,label_id,agent_role,status) VALUES ('t','a','reviewer','PRETEND')")
assert db.execute("SELECT l.id FROM lw_labels l JOIN lw_memberships m ON m.label_id=l.id WHERE m.user_id=1").fetchall()==[('a',)]
print('PASS: migration, membership scope, duplicate membership, task status, cross-label asset/task/approval references')
