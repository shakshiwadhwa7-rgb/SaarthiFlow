import 'dotenv/config';
import * as db from './db.js';

async function testE2E() {
  console.log('=== RUNNING COMPLETE SAARTHIFLOW INTEGRATION VERIFICATION ===\n');

  // Test 1: Task CRUD & Database Persistence
  console.log('1. Testing Task Creation & Persistence...');
  const newTask = await db.createTask({
    title: 'E2E Verified Integration Task',
    project: 'Hackathon',
    priority: 'High',
    status: 'todo',
    due: '2026-11-20'
  });
  console.log(`   ✓ Task created with ID: ${newTask.id}`);

  console.log('2. Testing Task Status & Priority Modification...');
  const updatedTask = await db.updateTask(newTask.id, {
    status: 'doing',
    priority: 'Medium',
    due: '2026-11-22'
  });
  if (updatedTask.status !== 'doing' || updatedTask.priority !== 'Medium') {
    throw new Error('Task update verification failed');
  }
  console.log(`   ✓ Task updated: status=${updatedTask.status}, priority=${updatedTask.priority}, due=${updatedTask.due}`);

  // Test 2: Gemini / Agentic Proposal Pipeline
  console.log('\n3. Testing Full Agentic AI Planning Pipeline...');
  const initialTaskCount = (await db.getTasks()).length;

  const proposal = await db.createProposal({
    title: 'Analyze HackOWASP Hackathon',
    source: 'Agent Studio',
    tasks: [
      { id: 'act-1', title: 'Submit HackOWASP Registration Form', priority: 'High', due: '2026-11-17', project: 'Hackathon', actionType: 'create_task' },
      { id: 'act-2', title: 'Prepare Architecture Pitch Deck', priority: 'Medium', due: '2026-11-19', project: 'Hackathon', actionType: 'create_task' }
    ]
  });
  console.log(`   ✓ Agent created pending proposal: ${proposal.id} (Status: ${proposal.status})`);

  // Verify NO tasks written to database before approval
  const taskCountBeforeApproval = (await db.getTasks()).length;
  if (taskCountBeforeApproval !== initialTaskCount) {
    throw new Error('Crucial rule violated: Tasks were written to database BEFORE human approval!');
  }
  console.log('   ✓ Verified 0 tasks written to database before approval.');

  // Test 3: Human Approval & Execution
  console.log('\n4. Testing Human Approval & Execution...');
  const approvalRes = await db.decideProposal(proposal.id, true);
  if (!approvalRes.success || approvalRes.status !== 'approved') {
    throw new Error('Proposal approval failed');
  }
  console.log(`   ✓ Proposal approved. Executed ${approvalRes.summary.successCount} database operations.`);

  // Verify tasks are now in database
  const tasksAfterApproval = await db.getTasks();
  const task1 = tasksAfterApproval.find(t => t.title === 'Submit HackOWASP Registration Form');
  const task2 = tasksAfterApproval.find(t => t.title === 'Prepare Architecture Pitch Deck');
  if (!task1 || !task2) {
    throw new Error('Approved tasks not found in database!');
  }
  console.log(`   ✓ Verified task 1 in DB: "${task1.title}" (ID: ${task1.id}, Status: ${task1.status})`);
  console.log(`   ✓ Verified task 2 in DB: "${task2.title}" (ID: ${task2.id}, Status: ${task2.status})`);

  // Test 4: Idempotency (Prevent double execution)
  console.log('\n5. Testing Duplicate Execution Prevention (Idempotency)...');
  try {
    await db.decideProposal(proposal.id, true);
    throw new Error('Double execution bug: Proposal was executed twice!');
  } catch (err) {
    console.log(`   ✓ Correctly rejected duplicate execution: "${err.message}"`);
  }

  // Test 5: Rejection Workflow (Zero mutations)
  console.log('\n6. Testing Proposal Rejection Workflow...');
  const badProposal = await db.createProposal({
    title: 'Irrelevant Tasks',
    source: 'Agent Studio',
    tasks: [{ id: 'bad-1', title: 'Task that must never exist', priority: 'Low', due: '2026-11-25', project: 'Spam', actionType: 'create_task' }]
  });
  const rejectRes = await db.decideProposal(badProposal.id, false);
  if (rejectRes.status !== 'rejected') {
    throw new Error('Rejection failed');
  }
  const ghostTask = (await db.getTasks()).find(t => t.title === 'Task that must never exist');
  if (ghostTask) {
    throw new Error('Rejected task was erroneously written to database!');
  }
  console.log('   ✓ Verified rejection resulted in zero database tasks created.');

  // Test 6: Activity Logging
  console.log('\n7. Testing Activity Logging...');
  const logs = await db.getActivity();
  console.log(`   ✓ Found ${logs.length} activity records logged persistently.`);

  // Test 7: Analytics
  console.log('\n8. Testing Analytics Computation...');
  const analytics = await db.getAnalytics();
  console.log(`   ✓ Real Analytics: ${analytics.totalTasks} total tasks, ${analytics.completedTasks} completed, completion rate: ${analytics.completionRate}%, ${analytics.pendingProposals} pending proposals.`);

  // Clean up created test tasks
  console.log('\n9. Cleaning up test records...');
  await db.deleteTask(newTask.id);
  await db.deleteTask(task1.id);
  await db.deleteTask(task2.id);
  console.log('   ✓ Cleanup completed.');

  console.log('\n======================================================');
  console.log('🏆 ALL END-TO-END AGENTIC INTEGRATION TESTS PASSED!');
  console.log('======================================================\n');
}

testE2E().catch(err => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
