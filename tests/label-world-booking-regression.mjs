import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fixture} from './label-world-api-fixture.mjs'
const {sqlite,db,app,env}=fixture()
const messages=await import('../src/lib/db-messages.ts')
sqlite.exec('CREATE TABLE bookings(id INTEGER PRIMARY KEY,engineer_profile_id INTEGER,customer_email TEXT);INSERT INTO bookings VALUES (1,5,\'customer@example.invalid\');INSERT INTO bookings VALUES (2,6,\'other@example.invalid\')')
sqlite.exec(readFileSync('migrations/0017_messages.sql','utf8'))
await messages.sendMessage(db,{bookingId:1,senderType:'customer',senderName:'Test customer',body:'Booking-specific message'})
await messages.sendMessage(db,{bookingId:1,senderType:'engineer',senderName:'Test engineer',body:'Engineer response'})
assert.equal((await messages.getMessagesForBooking(db,1)).length,2);assert.equal((await messages.getMessagesForBooking(db,2)).length,0)
assert.deepEqual(await messages.getUnreadCountsForEngineer(db,5),{1:1});assert.deepEqual(await messages.getUnreadCountsForCustomerEmail(db,'CUSTOMER@example.invalid'),{1:1});assert.deepEqual(await messages.getUnreadCountsForEngineer(db,6),{})
await messages.markMessagesReadByEngineer(db,1);await messages.markMessagesReadByCustomer(db,1);assert.deepEqual(await messages.getUnreadCountsForEngineer(db,5),{});assert.deepEqual(await messages.getUnreadCountsForCustomerEmail(db,'customer@example.invalid'),{})
sqlite.exec("INSERT INTO lw_labels(id,name) VALUES ('test-label','Test'); INSERT INTO lw_memberships VALUES ('test-label',1,'owner')")
const r=await app.request('http://localhost/api/label-world/labels/test-label/inbox/researcher/messages',{method:'POST',headers:{Cookie:'studio2u_session=test-session-1',Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({content:'Employee-specific message',messageId:crypto.randomUUID()})},env);assert.equal(r.status,201)
assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM messages').get().n,2);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM lw_employee_messages').get().n,1)
const anonymous=await app.request('http://localhost/api/label-world/labels/test-label/inbox/researcher/messages?email=customer@example.invalid',{},env);assert.equal(anonymous.status,401)
console.log('PASS: original booking messages, sender/read flags, engineer/customer unread scopes, separate employee persistence and no query-email authentication bypass')
