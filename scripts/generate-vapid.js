import webPush from "web-push";

const vapidKeys = webPush.generateVAPIDKeys();

console.log("\n=======================================");
console.log("🚀 VAPID Keys Generated Successfully! 🚀");
console.log("=======================================\n");

console.log("Please add the following variables to your .env.local file:\n");

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log("\nMake sure to also add these to your Vercel Environment Variables for production.");
console.log("=======================================\n");
