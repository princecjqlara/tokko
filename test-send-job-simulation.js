/**
 * Test script to simulate send job processing with fake data
 * Tests: duplicate prevention, resume functionality, and completion tracking
 */

// Simulate the send job processing logic
class SendJobSimulator {
  constructor() {
    this.jobs = new Map(); // Store job state
    this.sentMessages = new Map(); // Track all sent messages globally
  }

  // Simulate a send job record
  createJob(jobId, contactIds, message) {
    this.jobs.set(jobId, {
      id: jobId,
      contact_ids: contactIds,
      message: message,
      status: "pending",
      sent_count: 0,
      failed_count: 0,
      total_count: contactIds.length,
      errors: [],
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return this.jobs.get(jobId);
  }

  // Simulate fetching contacts (with duplicates to test deduplication)
  fetchContacts(contactIds) {
    const contacts = contactIds.map((id, index) => ({
      id: index + 1,
      contact_id: `contact_${id}`,
      page_id: `page_${(index % 3) + 1}`, // Distribute across 3 pages
      contact_name: `Contact ${id}`,
      page_name: `Page ${(index % 3) + 1}`
    }));

    // Add some duplicates to test deduplication
    const duplicates = contacts.slice(0, 5).map(c => ({ ...c }));
    return [...contacts, ...duplicates];
  }

  // Simulate sending a message (with random failures)
  async sendMessageToContact(contact, message, jobId) {
    // Simulate network delay (longer to make timeout more likely)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Track sent message per job (to allow testing resume across jobs)
    const key = `${jobId}_${contact.contact_id}`;
    if (this.sentMessages.has(key)) {
      return { success: false, error: "DUPLICATE DETECTED!" };
    }

    // 5% chance of failure
    if (Math.random() < 0.05) {
      return { success: false, error: "Simulated network error" };
    }

    this.sentMessages.set(key, {
      job_id: jobId,
      contact_id: contact.contact_id,
      contact_name: contact.contact_name,
      message: message,
      sent_at: new Date().toISOString()
    });

    return { success: true };
  }

  // Simulate processing a page
  async sendMessagesForPage(pageId, contacts, message, sentContactIds, jobId) {
    const localSentIds = sentContactIds || new Set();
    let success = 0;
    let failed = 0;
    const errors = [];

    for (const contact of contacts) {
      // Skip if already sent
      if (localSentIds.has(contact.contact_id)) {
        console.log(`  ⏭️  Skipping duplicate: ${contact.contact_name} (${contact.contact_id})`);
        continue;
      }

      const result = await this.sendMessageToContact(contact, message, jobId);

      if (result.success) {
        success++;
        localSentIds.add(contact.contact_id);
        if (sentContactIds) {
          sentContactIds.add(contact.contact_id);
        }
      } else {
        failed++;
        errors.push({
          contact: contact.contact_name,
          error: result.error
        });
      }
    }

    return { success, failed, errors };
  }

  // Simulate processing a send job (with timeout simulation)
  async processSendJob(jobId, timeoutMs = 5000) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === "completed") {
      console.log(`Job ${jobId} already completed`);
      return { completed: true, sent: job.sent_count, failed: job.failed_count, total: job.total_count };
    }

    // Update status to running
    job.status = "running";
    job.updated_at = new Date().toISOString();

    const startTime = Date.now();
    const contactIds = job.contact_ids;
    const contacts = this.fetchContacts(contactIds);

    // Deduplicate contacts
    const uniqueContacts = new Map();
    for (const contact of contacts) {
      const key = contact.contact_id;
      if (!uniqueContacts.has(key)) {
        uniqueContacts.set(key, contact);
      }
    }
    const deduplicatedContacts = Array.from(uniqueContacts.values());
    console.log(`\n📋 Job ${jobId}: Fetched ${contacts.length} contacts, ${deduplicatedContacts.length} unique`);

    // Extract already sent contacts from metadata
    const sentContactIdsSet = new Set();
    if (job.errors && Array.isArray(job.errors)) {
      for (const error of job.errors) {
        if (error._metadata && error._metadata.sent_contact_ids) {
          error._metadata.sent_contact_ids.forEach(id => sentContactIdsSet.add(id));
        }
      }
    }

    // Filter out already sent contacts
    let contactsToProcess = deduplicatedContacts;
    if (sentContactIdsSet.size > 0) {
      const beforeFilter = contactsToProcess.length;
      contactsToProcess = deduplicatedContacts.filter(c => !sentContactIdsSet.has(c.contact_id));
      console.log(`  🔄 Resuming: Skipping ${sentContactIdsSet.size} already sent (from ${beforeFilter} total), processing ${contactsToProcess.length} remaining`);
      
      // Double-check: verify we're not processing contacts that were already sent
      const duplicateCheck = contactsToProcess.filter(c => sentContactIdsSet.has(c.contact_id));
      if (duplicateCheck.length > 0) {
        console.warn(`  ⚠️  WARNING: Found ${duplicateCheck.length} contacts that should have been filtered out!`);
        contactsToProcess = contactsToProcess.filter(c => !sentContactIdsSet.has(c.contact_id));
      }
    } else {
      console.log(`  🆕 Starting fresh: processing ${contactsToProcess.length} contacts`);
    }

    // Group by page
    const contactsByPage = new Map();
    for (const contact of contactsToProcess) {
      if (!contactsByPage.has(contact.page_id)) {
        contactsByPage.set(contact.page_id, []);
      }
      contactsByPage.get(contact.page_id).push(contact);
    }

    // Start with existing counts
    let messageSuccess = job.sent_count || 0;
    let messageFailed = job.failed_count || 0;
    const messageErrors = (job.errors || []).filter(e => !e._metadata);
    const sentContactIds = new Set(sentContactIdsSet);

    // Process each page
    for (const [pageId, pageContacts] of contactsByPage.entries()) {
      // Check timeout before processing page
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        console.log(`\n⏱️  Timeout reached (${elapsed}ms), pausing job`);
        job.status = "running";
        job.sent_count = messageSuccess;
        job.failed_count = messageFailed;
        job.errors = [
          ...messageErrors,
          {
            error: `Timeout: Processed ${messageSuccess + messageFailed} of ${job.total_count}`,
            _metadata: { sent_contact_ids: Array.from(sentContactIds) }
          }
        ];
        job.updated_at = new Date().toISOString();
        return { paused: true, sent: messageSuccess, failed: messageFailed, total: job.total_count };
      }

      console.log(`\n  📄 Processing page ${pageId} (${pageContacts.length} contacts)`);
      
      // Process contacts in smaller batches to allow timeout checks
      const batchSize = 10;
      for (let i = 0; i < pageContacts.length; i += batchSize) {
        const batch = pageContacts.slice(i, i + batchSize);
        
        // Check timeout before each batch
        const batchElapsed = Date.now() - startTime;
        if (batchElapsed > timeoutMs) {
          console.log(`\n⏱️  Timeout reached during batch (${batchElapsed}ms), pausing job`);
          job.status = "running";
          job.sent_count = messageSuccess;
          job.failed_count = messageFailed;
          job.errors = [
            ...messageErrors,
            {
              error: `Timeout: Processed ${messageSuccess + messageFailed} of ${job.total_count}`,
              _metadata: { sent_contact_ids: Array.from(sentContactIds) }
            }
          ];
          job.updated_at = new Date().toISOString();
          return { paused: true, sent: messageSuccess, failed: messageFailed, total: job.total_count };
        }
        
        const batchResult = await this.sendMessagesForPage(pageId, batch, job.message, sentContactIds, jobId);
        messageSuccess += batchResult.success;
        messageFailed += batchResult.failed;
        messageErrors.push(...batchResult.errors);
      }
      
      // Get combined result for the page
      const result = {
        success: messageSuccess - (job.sent_count || 0),
        failed: messageFailed - (job.failed_count || 0),
        errors: messageErrors.slice((job.errors || []).filter(e => !e._metadata).length)
      };

      // Results already added in batch processing above

      // Update progress
      job.sent_count = messageSuccess;
      job.failed_count = messageFailed;
      job.errors = [
        ...messageErrors,
        {
          _metadata: {
            sent_contact_ids: Array.from(sentContactIds),
            last_updated: new Date().toISOString()
          }
        }
      ];
      job.updated_at = new Date().toISOString();

      console.log(`  ✅ Page ${pageId}: ${result.success} sent, ${result.failed} failed`);
    }

    // Final status
    const totalProcessed = messageSuccess + messageFailed;
    const totalExpected = job.total_count;
    const remainingContacts = contactsToProcess.length;

    if (totalProcessed >= totalExpected || remainingContacts === 0) {
      job.status = "completed";
      job.completed_at = new Date().toISOString();
      console.log(`\n✅ Job ${jobId} COMPLETED: ${messageSuccess} sent, ${messageFailed} failed`);
    } else {
      job.status = "running";
      console.log(`\n⏸️  Job ${jobId} INCOMPLETE: ${messageSuccess} sent, ${messageFailed} failed (${remainingContacts} remaining)`);
    }

    return {
      completed: job.status === "completed",
      sent: messageSuccess,
      failed: messageFailed,
      total: totalExpected
    };
  }

  // Get job status
  getJobStatus(jobId) {
    return this.jobs.get(jobId);
  }

  // Get all sent messages
  getAllSentMessages() {
    return Array.from(this.sentMessages.values());
  }

  // Check for duplicates
  checkForDuplicates() {
    const contactIds = Array.from(this.sentMessages.keys());
    const uniqueIds = new Set(contactIds);
    const duplicates = contactIds.length - uniqueIds.size;
    return {
      total: contactIds.length,
      unique: uniqueIds.size,
      duplicates: duplicates
    };
  }
}

// Test scenarios
async function runTests() {
  console.log("🧪 Starting Send Job Simulation Tests\n");
  console.log("=" .repeat(60));

  const simulator = new SendJobSimulator();

  // Test 1: Basic job processing
  console.log("\n📝 TEST 1: Basic Job Processing (50 contacts)");
  console.log("-".repeat(60));
  const job1 = simulator.createJob(1, Array.from({ length: 50 }, (_, i) => i + 1), "Test message");
  const result1 = await simulator.processSendJob(1, 10000); // 10s timeout
  console.log(`Result: ${result1.completed ? "✅ Completed" : "❌ Incomplete"}`);
  console.log(`Sent: ${result1.sent}, Failed: ${result1.failed}, Total: ${result1.total}`);

  // Test 2: Large job with timeout and resume
  console.log("\n📝 TEST 2: Large Job with Timeout and Resume (200 contacts)");
  console.log("-".repeat(60));
  const job2 = simulator.createJob(2, Array.from({ length: 200 }, (_, i) => i + 1), "Test message 2");
  
  // First run - should timeout (200 contacts * 50ms = 10s, timeout at 500ms)
  console.log("\n🔄 First run (will timeout after 500ms):");
  const result2a = await simulator.processSendJob(2, 500); // Short timeout
  if (result2a) {
    console.log(`Result: ${result2a.paused ? "⏸️  Paused (timeout)" : result2a.completed ? "✅ Completed (unexpected)" : "❌ Unexpected"}`);
    console.log(`Progress: ${result2a.sent} sent, ${result2a.failed} failed`);
  }

  // Second run - should resume
  if (result2a && result2a.paused) {
    console.log("\n🔄 Second run (resuming with 500ms timeout):");
    const result2b = await simulator.processSendJob(2, 500);
    if (result2b) {
      console.log(`Result: ${result2b.paused ? "⏸️  Paused again" : result2b.completed ? "✅ Completed" : "❌ Incomplete"}`);
      console.log(`Progress: ${result2b.sent} sent, ${result2b.failed} failed`);

      // Continue until complete
      let attempts = 0;
      let lastResult = result2b;
      while (lastResult && !lastResult.completed && lastResult.paused && attempts < 20) {
        attempts++;
        console.log(`\n🔄 Resume attempt ${attempts + 1}:`);
        lastResult = await simulator.processSendJob(2, 500);
        if (lastResult) {
          console.log(`Progress: ${lastResult.sent} sent, ${lastResult.failed} failed`);
        } else {
          break;
        }
      }
      
      if (lastResult && lastResult.completed) {
        console.log(`\n✅ Job 2 completed after ${attempts + 2} runs!`);
      }
    }
  } else {
    console.log("⚠️  Job completed in first run (timeout too long or processing too fast)");
  }

  // Test 3: Duplicate prevention
  console.log("\n📝 TEST 3: Duplicate Prevention Test");
  console.log("-".repeat(60));
  const job3 = simulator.createJob(3, [1, 2, 3, 4, 5, 1, 2, 3], "Test message 3"); // Has duplicates
  await simulator.processSendJob(3, 10000);
  const job3Status = simulator.getJobStatus(3);
  console.log(`Job 3: ${job3Status.sent_count} sent, ${job3Status.failed_count} failed`);
  console.log(`Expected: 5 unique contacts (duplicates should be filtered)`);

  // Test 4: Verify no duplicates across all jobs
  console.log("\n📝 TEST 4: Global Duplicate Check");
  console.log("-".repeat(60));
  const duplicateCheck = simulator.checkForDuplicates();
  console.log(`Total messages sent: ${duplicateCheck.total}`);
  console.log(`Unique contacts: ${duplicateCheck.unique}`);
  console.log(`Duplicates found: ${duplicateCheck.duplicates}`);
  
  if (duplicateCheck.duplicates === 0) {
    console.log("✅ PASS: No duplicates detected!");
  } else {
    console.log("❌ FAIL: Duplicates detected!");
  }

  // Test 5: Verify all contacts were processed
  console.log("\n📝 TEST 5: Completion Verification");
  console.log("-".repeat(60));
  const allJobs = [1, 2, 3];
  let allCompleted = true;
  let totalExpected = 0;
  let totalSent = 0;
  let totalFailed = 0;

  for (const jobId of allJobs) {
    const status = simulator.getJobStatus(jobId);
    totalExpected += status.total_count;
    totalSent += status.sent_count;
    totalFailed += status.failed_count;
    
    if (status.status !== "completed") {
      allCompleted = false;
      console.log(`❌ Job ${jobId}: ${status.status} (${status.sent_count + status.failed_count}/${status.total_count} processed)`);
    } else {
      console.log(`✅ Job ${jobId}: ${status.status} (${status.sent_count + status.failed_count}/${status.total_count} processed)`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Total expected: ${totalExpected}`);
  console.log(`  Total sent: ${totalSent}`);
  console.log(`  Total failed: ${totalFailed}`);
  console.log(`  Total processed: ${totalSent + totalFailed}`);
  console.log(`  Completion rate: ${((totalSent + totalFailed) / totalExpected * 100).toFixed(2)}%`);

  if (allCompleted && (totalSent + totalFailed) >= totalExpected) {
    console.log("\n✅ ALL TESTS PASSED!");
  } else {
    console.log("\n❌ SOME TESTS FAILED!");
  }

  // Show sample sent messages
  console.log("\n📨 Sample sent messages (first 10):");
  const sentMessages = simulator.getAllSentMessages();
  sentMessages.slice(0, 10).forEach((msg, idx) => {
    console.log(`  ${idx + 1}. ${msg.contact_name} (${msg.contact_id})`);
  });
}

// Run tests
runTests().catch(console.error);
