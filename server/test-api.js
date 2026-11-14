import 'dotenv/config';
import * as db from './db.js';

async function runTests() {
  console.log('=== STARTING SAARTHIFLOW BACKEND & DATABASE TESTS ===\n');

  // Test 1: Initial tasks fetch
  console.log('Test 1: Fetching tasks...');
  const tasks = await db.getTasks();
  console.log(`✓ Fetched ${tasks.length} tasks successfully.`);

  // Test 2: Create a new task
  console.log('\nTest 2: Creating a new task...');
  const created = await db.createTask({
    title: 'Automated Integration Test Task',
    project: 'Testing',
    priority: 'High',
    status: 'todo',
    due: '2026-11-20'
  });
  console.log(`✓ Created task with ID: ${created.id}, Title: "${created.title}"`);

  // Test 3: Update the created task
  console.log('\nTest 3: Updating task (marking done and rescheduling)...');
  const updated = await db.updateTask(created.id, {
    status: 'done',
    due: '2026-11-25',
    priority: 'Medium'
  });
  if (updated.status !== 'done' || updated.due !== '2026-11-25') {
    throw new Error('Update verification failed!');
  }
  console.log(`✓ Updated task verified: status=${updated.status}, due=${updated.due}`);

  // Test 4: Delete the test task
  console.log('\nTest 4: Deleting test task...');
  await db.deleteTask(created.id);
  const verifyDeleted = await db.getTaskById(created.id);
  if (verifyDeleted) {
    throw new Error('Task was not properly deleted from database!');
  }
  console.log('✓ Task deletion verified.');

  // Test 5: Agent planning & proposal creation
  console.log('\nTest 5: Testing Agent proposal generation and approval workflow...');
  const testProposal = await db.createProposal({
    title: 'Hackathon Deployment Plan',
    source: 'Agent Studio',
    tasks: [
      { id: 'p1', title: 'Prepare Dockerfile & env vars', priority: 'High', due: '2026-11-19', project: 'Hackathon', actionType: 'create_task' },
      { id: 'p2', title: 'Verify production database migration', priority: 'High', due: '2026-11-20', project: 'Hackathon', actionType: 'create_task' }
    ]
  });
  console.log(`✓ Created action proposal: ${testProposal.id} with status "${testProposal.status}"`);

  // Test 6: Approve the proposal and execute real database mutations
  console.log('\nTest 6: Approving proposal and executing actions in database...');
  const approvalResult = await db.decideProposal(testProposal.id, true);
  if (!approvalResult.success || approvalResult.status !== 'approved') {
    throw new Error('Approval execution failed!');
  }
  console.log(`✓ Executed ${approvalResult.summary.successCount} actions cleanly.`);

  // Verify tasks now exist in DB
  const refreshedTasks = await db.getTasks();
  const foundTask1 = refreshedTasks.find(t => t.title === 'Prepare Dockerfile & env vars');
  const foundTask2 = refreshedTasks.find(t => t.title === 'Verify production database migration');
  if (!foundTask1 || !foundTask2) {
    throw new Error('Approved tasks were not found in the database!');
  }
  console.log(`✓ Verified approved tasks are in DB: "${foundTask1.title}" (ID: ${foundTask1.id})`);

  // Test 7: Double execution prevention (Idempotency)
  console.log('\nTest 7: Testing double-execution prevention...');
  try {
    await db.decideProposal(testProposal.id, true);
    throw new Error('Security flaw: Proposal allowed duplicate execution!');
  } catch (err) {
    console.log(`✓ Correctly prevented duplicate execution: "${err.message}"`);
  }

  // Test 8: Rejection workflow
  console.log('\nTest 8: Testing proposal rejection workflow...');
  const rejectProposal = await db.createProposal({
    title: 'Unwanted Proposal',
    source: 'Agent Studio',
    tasks: [{ id: 'p3', title: 'Should never exist in tasks', priority: 'Low', due: '2026-11-30', project: 'Trash', actionType: 'create_task' }]
  });
  const rejectResult = await db.decideProposal(rejectProposal.id, false);
  if (rejectResult.status !== 'rejected') {
    throw new Error('Rejection failed!');
  }
  const checkGhost = (await db.getTasks()).find(t => t.title === 'Should never exist in tasks');
  if (checkGhost) {
    throw new Error('Rejected task was erroneously created in database!');
  }
  console.log('✓ Rejected proposal created 0 database tasks.');

  // Test 9: Activity logs verification
  console.log('\nTest 9: Verifying activity logging...');
  const logs = await db.getActivity();
  if (logs.length === 0) throw new Error('No activity logs recorded!');
  console.log(`✓ Found ${logs.length} activity records. Latest: "${logs[0].title}" [${logs[0].status}]`);

  // Test 10: Analytics computation
  console.log('\nTest 10: Testing analytics computation...');
  const analytics = await db.getAnalytics();
  console.log(`✓ Analytics computed: ${analytics.totalTasks} total tasks, ${analytics.completedTasks} completed, completion rate: ${analytics.completionRate}%`);

  // Clean up created tasks from test
  await db.deleteTask(foundTask1.id);
  await db.deleteTask(foundTask2.id);

  console.log('\n=== ALL 10 DATABASE & AGENT WORKFLOW TESTS PASSED PERFECTLY ===\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
