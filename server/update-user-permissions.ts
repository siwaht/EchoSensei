import { db } from './db';
import { users } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function updateUserPermissions() {
  console.log('🔧 Updating existing users with default permissions...');

  // Default permissions for all users
  const defaultPermissions = [
    'manage_users',
    'manage_branding',
    'manage_voices',
    'manage_agents',
    'access_playground',
    'view_call_history',
    'manage_phone_numbers'
  ];

  try {
    // Get all existing users
    const allUsers = await db().select().from(users);
    console.log(`Found ${allUsers.length} users to update`);

    for (const user of allUsers) {
      // Skip admin users, they already have all permissions
      if (user.isAdmin) {
        console.log(`Skipping admin user: ${user.email}`);
        continue;
      }

      // Merge existing permissions with default permissions
      const existingPermissions = (user.permissions as string[]) || [];
      const mergedPermissions = [...new Set([...existingPermissions, ...defaultPermissions])];

      // Update the user's permissions
      await db()
        .update(users)
        .set({ 
          permissions: mergedPermissions,
          updatedAt: new Date()
        })
        .where(sql`${users.id} = ${user.id}`);

      console.log(`✅ Updated permissions for: ${user.email}`);
      console.log(`   Added: ${defaultPermissions.filter(p => !existingPermissions.includes(p)).join(', ')}`);
    }

    console.log('✨ All users have been updated with default permissions!');
    console.log('\nDefault permissions added:');
    defaultPermissions.forEach(p => console.log(`  - ${p}`));

  } catch (error) {
    console.error('❌ Error updating user permissions:', error);
    throw error;
  }
}

// Run the update
updateUserPermissions()
  .then(() => {
    console.log('\n✅ Permission update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to update permissions:', error);
    process.exit(1);
  });