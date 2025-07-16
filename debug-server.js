console.log('Starting debug server...');

try {
  console.log('Importing http...');
  const { createServer } = require('http');
  console.log('✓ http imported');

  console.log('Importing url...');
  const { parse } = require('url');
  console.log('✓ url imported');

  console.log('Importing next...');
  const next = require('next');
  console.log('✓ next imported');

  console.log('Importing socket.io...');
  const { Server } = require('socket.io');
  console.log('✓ socket.io imported');

  console.log('Setting up Next.js...');
  const dev = process.env.NODE_ENV !== 'production';
  console.log('Development mode:', dev);
  
  const app = next({ dev });
  console.log('✓ Next.js app created');

  console.log('About to prepare Next.js app...');
  
  // Set a timeout for app.prepare()
  const preparePromise = app.prepare();
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Next.js preparation timed out after 30 seconds')), 30000);
  });

  Promise.race([preparePromise, timeoutPromise])
    .then(() => {
      console.log('✓ Next.js app prepared successfully!');
      console.log('Debug completed - Next.js is working');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to prepare Next.js app:', error);
      process.exit(1);
    });

} catch (error) {
  console.error('Error during module import:', error);
  process.exit(1);
}
