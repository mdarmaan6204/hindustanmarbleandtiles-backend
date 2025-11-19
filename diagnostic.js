#!/usr/bin/env node

/**
 * MongoDB Connection Diagnostic Tool
 * Tests connection to MongoDB Atlas and provides solutions
 */

const dns = require('dns');
const net = require('net');

console.log('🔍 MongoDB Connection Diagnostic Tool\n');

// Test 1: DNS Resolution
console.log('Test 1: DNS Resolution');
console.log('━━━━━━━━━━━━━━━━━━━━');
const host = 'ac-11xxhdr-shard-00-00.qrnffeg.mongodb.net';
dns.lookup(host, (err, address, family) => {
  if (err) {
    console.log(`❌ DNS Resolution Failed for ${host}`);
    console.log(`   Error: ${err.code}`);
    console.log('\n   This means:');
    console.log('   - Your computer cannot resolve MongoDB DNS');
    console.log('   - Likely causes:');
    console.log('     1. No internet connection');
    console.log('     2. DNS server is down');
    console.log('     3. DNS cache issue');
    console.log('\n   Solution:');
    console.log('     - Check internet connection');
    console.log('     - Restart router/modem');
    console.log('     - Try: ipconfig /flushdns (Windows PowerShell as Admin)');
  } else {
    console.log(`✅ DNS Resolution Successful`);
    console.log(`   Host: ${host}`);
    console.log(`   IP Address: ${address}`);
    console.log(`   IPv${family}`);
    
    // Test 2: Port Connection
    console.log('\nTest 2: Port Connection (27017)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const socket = net.createConnection({
      host: address,
      port: 27017,
      timeout: 5000
    });
    
    socket.on('connect', () => {
      console.log('✅ Port 27017 is accessible');
      console.log('   MongoDB server is reachable');
      socket.destroy();
      
      console.log('\nTest 3: MongoDB Credentials');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Your MongoDB Connection String:');
      console.log('mongodb+srv://wasim:8581808501@cluster0.qrnffeg.mongodb.net/inventory');
      console.log('\n✅ If above tests pass, the issue is likely:');
      console.log('   - MongoDB Atlas Network Access IP whitelist');
      console.log('   - OR Invalid credentials');
      console.log('\nSolution:');
      console.log('   1. Go to: https://cloud.mongodb.com/');
      console.log('   2. Clusters → Security → Network Access');
      console.log('   3. Add your current IP: YOUR_IP/32');
      console.log('   4. Or allow all: 0.0.0.0/0 (development only)');
      console.log('   5. Wait 1-2 minutes for whitelist to update');
      console.log('   6. Try connecting again');
    });
    
    socket.on('timeout', () => {
      console.log('⏱️  Connection Timeout (5 seconds)');
      console.log('   Cannot reach MongoDB on port 27017');
      console.log('\n   Possible causes:');
      console.log('   - Firewall blocking port 27017');
      console.log('   - VPN blocking connection');
      console.log('   - Network restriction');
      console.log('\n   Solution:');
      console.log('   - Disable VPN if using one');
      console.log('   - Check firewall settings');
      console.log('   - Try on different network');
      socket.destroy();
    });
    
    socket.on('error', (err) => {
      console.log(`❌ Connection Error: ${err.code}`);
      console.log(`   ${err.message}`);
      console.log('\n   Likely causes:');
      console.log('   - Port 27017 blocked by firewall');
      console.log('   - VPN blocking connection');
      console.log('   - Your IP not whitelisted in MongoDB Atlas');
      console.log('\n   Solution:');
      console.log('   1. Check MongoDB Atlas Network Access whitelist');
      console.log('   2. Add your IP address or allow 0.0.0.0/0');
      console.log('   3. Disable VPN if using one');
      console.log('   4. Check firewall settings');
    });
  }
});

// Test internet connectivity
console.log('\nTest 0: Internet Connectivity');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━');
dns.lookup('google.com', (err, address) => {
  if (err) {
    console.log('❌ No Internet Connection');
    console.log('   Cannot resolve google.com');
    console.log('   Please check your internet connection');
  } else {
    console.log('✅ Internet Connected');
    console.log(`   Resolved google.com to ${address}`);
  }
});

console.log('\n📚 For detailed troubleshooting, see:');
console.log('   MONGODB_TROUBLESHOOTING.md\n');
