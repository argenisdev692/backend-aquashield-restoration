<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Modules\Users\Infrastructure\Persistence\Eloquent\Models\UserEloquentModel as User;
use Ramsey\Uuid\Uuid;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // ============================================
        // ROLES CREATION SECTION - UPPERCASE PATTERN
        // ============================================

        // CORE ROLES
        $superAdminRole = Role::create([
            'name' => 'SUPER_ADMIN',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $adminRole = Role::create([
            'name' => 'ADMIN',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $managerRole = Role::create([
            'name' => 'MANAGER',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $userRole = Role::create([
            'name' => 'USER',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        // BUSINESS ROLES
        $marketingManagerRole = Role::create([
            'name' => 'MARKETING_MANAGER',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $directorAssistantRole = Role::create([
            'name' => 'DIRECTOR_ASSISTANT',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $technicalSupervisorRole = Role::create([
            'name' => 'TECHNICAL_SUPERVISOR',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $representationCompanyRole = Role::create([
            'name' => 'REPRESENTATION_COMPANY',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $publicCompanyRole = Role::create([
            'name' => 'PUBLIC_COMPANY',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $externalOperatorsRole = Role::create([
            'name' => 'EXTERNAL_OPERATORS',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $publicAdjusterRole = Role::create([
            'name' => 'PUBLIC_ADJUSTER',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $insuranceAdjusterRole = Role::create([
            'name' => 'INSURANCE_ADJUSTER',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $technicalServicesRole = Role::create([
            'name' => 'TECHNICAL_SERVICES',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $marketingRole = Role::create([
            'name' => 'MARKETING',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $warehouseRole = Role::create([
            'name' => 'WAREHOUSE',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $administrativeRole = Role::create([
            'name' => 'ADMINISTRATIVE',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $collectionsRole = Role::create([
            'name' => 'COLLECTIONS',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $reportesRole = Role::create([
            'name' => 'REPORTES',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $salespersonRole = Role::create([
            'name' => 'SALESPERSON',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $leadRole = Role::create([
            'name' => 'LEAD',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $employeesRole = Role::create([
            'name' => 'EMPLOYEES',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $clientRole = Role::create([
            'name' => 'CLIENT',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $contactRole = Role::create([
            'name' => 'CONTACT',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        $spectatorRole = Role::create([
            'name' => 'SPECTATOR',
            'uuid' => Uuid::uuid4()->toString()
        ]);

        // ============================================
        // PERMISSIONS CREATION SECTION
        // ============================================

        // Define models for permissions
        $models = [
            'USER',
            'EMAIL_DATA',
            'SERVICE_CATEGORY',
            'PORTFOLIO',
            'COMPANY_DATA',
            'PROJECT_TYPE',
            'APPOINTMENT',
            'CONTACT_SUPPORT',
            'BLOG_CATEGORY',
            'POST',
            'SEO',
            'CALL_RECORD',
            'MODEL_AI',
            'ROLE',
            'PERMISSION',
            'INSURANCE_COMPANY',
            'INVOICE_DEMO',
            'INVOICE',
            'PUBLIC_COMPANY',
            'TYPE_DAMAGE',
            'CAUSE_OF_LOSS',
            'CLAIM_STATU',
            'ALLIANCE_COMPANY',
            'ZONE',
            'CATEGORY_PRODUCT',
            'CLAIM',
            'SCOPE_SHEET',
            'MANAGER',
            'SALESPERSON',
            'MARKETING_MANAGER',
            'DIRECTOR_ASSISTANT',
            'TECHNICAL_SUPERVISOR',
            'REPRESENTATION_COMPANY',
            'EXTERNAL_OPERATORS',
            'PUBLIC_ADJUSTER',
            'INSURANCE_ADJUSTER',
            'TECHNICAL_SERVICES',
            'MARKETING',
            'WAREHOUSE',
            'ADMINISTRATIVE',
            'COLLECTIONS',
            'REPORTES',
            'LEAD',
            'EMPLOYEES',
            'CLIENT',
            'CONTACT',
            'SPECTATOR',
            'W9FORM',
            'SALESPERSON_SIGNATURE',
            'SERVICE_REQUEST',
            'PRODUCT',
            'MORTGAGE_COMPANY',
            'CUSTOMER',
            'PROPERTIES',
        ];

        // Define actions for permissions
        $actions = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'RESTORE'];

        // Create all permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $allPermissions = [];
        foreach ($models as $model) {
            foreach ($actions as $action) {
                $permissionName = "{$action}_{$model}";
                Permission::create([
                    'name' => $permissionName,
                    'uuid' => Uuid::uuid4()->toString()
                ]);
                $allPermissions[] = $permissionName;
            }
        }

        // ============================================
        // ROLE PERMISSIONS ASSIGNMENT
        // ============================================

        // Flush Spatie's permission cache so that givePermissionTo()
        // resolves from DB instead of a stale in-memory cache.
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Super Admin - All permissions
        $superAdminRole->givePermissionTo($allPermissions);

        // Admin - Appointments and Call Records
        $adminPermissions = [
            'CREATE_APPOINTMENT',
            'READ_APPOINTMENT',
            'UPDATE_APPOINTMENT',
            'DELETE_APPOINTMENT',
            'RESTORE_APPOINTMENT',
            'CREATE_CONTACT_SUPPORT',
            'READ_CONTACT_SUPPORT',
            'UPDATE_CONTACT_SUPPORT',
            'DELETE_CONTACT_SUPPORT',
            'RESTORE_CONTACT_SUPPORT',
            'CREATE_CALL_RECORD',
            'READ_CALL_RECORD',
            'UPDATE_CALL_RECORD',
            'DELETE_CALL_RECORD',
            'RESTORE_CALL_RECORD'
        ];
        $adminRole->givePermissionTo($adminPermissions);

        // Manager - Invoice Demo, Invoice and other specific permissions
        $managerPermissions = [
            // Invoice Demo permissions
            'CREATE_INVOICE_DEMO',
            'READ_INVOICE_DEMO',
            'UPDATE_INVOICE_DEMO',
            'DELETE_INVOICE_DEMO',
            'RESTORE_INVOICE_DEMO',
            // Invoice permissions
            'CREATE_INVOICE',
            'READ_INVOICE',
            'UPDATE_INVOICE',
            'DELETE_INVOICE',
            'RESTORE_INVOICE',
            // Insurance Company permissions
            'CREATE_INSURANCE_COMPANY',
            'READ_INSURANCE_COMPANY',
            'UPDATE_INSURANCE_COMPANY',
            'DELETE_INSURANCE_COMPANY',
            'RESTORE_INSURANCE_COMPANY',
            // Public Company permissions
            'CREATE_PUBLIC_COMPANY',
            'READ_PUBLIC_COMPANY',
            'UPDATE_PUBLIC_COMPANY',
            'DELETE_PUBLIC_COMPANY',
            'RESTORE_PUBLIC_COMPANY',
            // Type Damage permissions
            'CREATE_TYPE_DAMAGE',
            'READ_TYPE_DAMAGE',
            'UPDATE_TYPE_DAMAGE',
            'DELETE_TYPE_DAMAGE',
            'RESTORE_TYPE_DAMAGE',
            // Cause of Loss permissions
            'CREATE_CAUSE_OF_LOSS',
            'READ_CAUSE_OF_LOSS',
            'UPDATE_CAUSE_OF_LOSS',
            'DELETE_CAUSE_OF_LOSS',
            'RESTORE_CAUSE_OF_LOSS',
            // Claim permissions
            'CREATE_CLAIM',
            'READ_CLAIM',
            'UPDATE_CLAIM',
            'DELETE_CLAIM',
            'RESTORE_CLAIM',
            // Public Adjuster permissions
            'CREATE_PUBLIC_ADJUSTER',
            'READ_PUBLIC_ADJUSTER',
            'UPDATE_PUBLIC_ADJUSTER',
            'DELETE_PUBLIC_ADJUSTER',
            'RESTORE_PUBLIC_ADJUSTER',
            // Product permissions
            'CREATE_PRODUCT',
            'READ_PRODUCT',
            'UPDATE_PRODUCT',
            'DELETE_PRODUCT',
            'RESTORE_PRODUCT',
            // Service Category permissions
            'CREATE_SERVICE_CATEGORY',
            'READ_SERVICE_CATEGORY',
            'UPDATE_SERVICE_CATEGORY',
            'DELETE_SERVICE_CATEGORY',
            'RESTORE_SERVICE_CATEGORY',
            // Service Request permissions
            'CREATE_SERVICE_REQUEST',
            'READ_SERVICE_REQUEST',
            'UPDATE_SERVICE_REQUEST',
            'DELETE_SERVICE_REQUEST',
            'RESTORE_SERVICE_REQUEST',
            // W9 Form permissions
            'CREATE_W9FORM',
            'READ_W9FORM',
            'UPDATE_W9FORM',
            'DELETE_W9FORM',
            'RESTORE_W9FORM',
            // Category Product permissions
            'CREATE_CATEGORY_PRODUCT',
            'READ_CATEGORY_PRODUCT',
            'UPDATE_CATEGORY_PRODUCT',
            'DELETE_CATEGORY_PRODUCT',
            'RESTORE_CATEGORY_PRODUCT',
            // Claim Status permissions
            'CREATE_CLAIM_STATU',
            'READ_CLAIM_STATU',
            'UPDATE_CLAIM_STATU',
            'DELETE_CLAIM_STATU',
            'RESTORE_CLAIM_STATU',
            // Alliance Company permissions
            'CREATE_ALLIANCE_COMPANY',
            'READ_ALLIANCE_COMPANY',
            'UPDATE_ALLIANCE_COMPANY',
            'DELETE_ALLIANCE_COMPANY',
            'RESTORE_ALLIANCE_COMPANY',
            // Salesperson Signature permissions
            'CREATE_SALESPERSON_SIGNATURE',
            'READ_SALESPERSON_SIGNATURE',
            'UPDATE_SALESPERSON_SIGNATURE',
            'DELETE_SALESPERSON_SIGNATURE',
            'RESTORE_SALESPERSON_SIGNATURE',
            // Mortgage Company permissions
            'CREATE_MORTGAGE_COMPANY',
            'READ_MORTGAGE_COMPANY',
            'UPDATE_MORTGAGE_COMPANY',
            'DELETE_MORTGAGE_COMPANY',
            'RESTORE_MORTGAGE_COMPANY',
            // Manager permissions
            'CREATE_MANAGER',
            'READ_MANAGER',
            'UPDATE_MANAGER',
            'DELETE_MANAGER',
            'RESTORE_MANAGER'
        ];
        $managerRole->givePermissionTo($managerPermissions);

        // User - Call Records only
        $userPermissions = [
            'CREATE_CALL_RECORD',
            'READ_CALL_RECORD',
            'UPDATE_CALL_RECORD',
            'DELETE_CALL_RECORD',
            'RESTORE_CALL_RECORD'
        ];
        $userRole->givePermissionTo($userPermissions);

        // Salesperson - Salesperson specific permissions
        $salespersonPermissions = [
            'CREATE_SALESPERSON',
            'READ_SALESPERSON',
            'UPDATE_SALESPERSON',
            'DELETE_SALESPERSON',
            'RESTORE_SALESPERSON'
        ];
        $salespersonRole->givePermissionTo($salespersonPermissions);

        // Marketing Manager - Marketing Manager specific permissions
        $marketingManagerPermissions = [
            'CREATE_MARKETING_MANAGER',
            'READ_MARKETING_MANAGER',
            'UPDATE_MARKETING_MANAGER',
            'DELETE_MARKETING_MANAGER',
            'RESTORE_MARKETING_MANAGER'
        ];
        $marketingManagerRole->givePermissionTo($marketingManagerPermissions);

        // Director Assistant - Director Assistant specific permissions
        $directorAssistantPermissions = [
            'CREATE_DIRECTOR_ASSISTANT',
            'READ_DIRECTOR_ASSISTANT',
            'UPDATE_DIRECTOR_ASSISTANT',
            'DELETE_DIRECTOR_ASSISTANT',
            'RESTORE_DIRECTOR_ASSISTANT'
        ];
        $directorAssistantRole->givePermissionTo($directorAssistantPermissions);

        // Technical Supervisor - Technical Supervisor specific permissions
        $technicalSupervisorPermissions = [
            'CREATE_TECHNICAL_SUPERVISOR',
            'READ_TECHNICAL_SUPERVISOR',
            'UPDATE_TECHNICAL_SUPERVISOR',
            'DELETE_TECHNICAL_SUPERVISOR',
            'RESTORE_TECHNICAL_SUPERVISOR'
        ];
        $technicalSupervisorRole->givePermissionTo($technicalSupervisorPermissions);

        // Continue with other roles...
        $representationCompanyRole->givePermissionTo(['CREATE_REPRESENTATION_COMPANY', 'READ_REPRESENTATION_COMPANY', 'UPDATE_REPRESENTATION_COMPANY', 'DELETE_REPRESENTATION_COMPANY', 'RESTORE_REPRESENTATION_COMPANY']);
        $publicCompanyRole->givePermissionTo(['CREATE_PUBLIC_COMPANY', 'READ_PUBLIC_COMPANY', 'UPDATE_PUBLIC_COMPANY', 'DELETE_PUBLIC_COMPANY', 'RESTORE_PUBLIC_COMPANY']);
        $externalOperatorsRole->givePermissionTo(['CREATE_EXTERNAL_OPERATORS', 'READ_EXTERNAL_OPERATORS', 'UPDATE_EXTERNAL_OPERATORS', 'DELETE_EXTERNAL_OPERATORS', 'RESTORE_EXTERNAL_OPERATORS']);
        $publicAdjusterRole->givePermissionTo(['CREATE_PUBLIC_ADJUSTER', 'READ_PUBLIC_ADJUSTER', 'UPDATE_PUBLIC_ADJUSTER', 'DELETE_PUBLIC_ADJUSTER', 'RESTORE_PUBLIC_ADJUSTER']);
        $insuranceAdjusterRole->givePermissionTo(['CREATE_INSURANCE_ADJUSTER', 'READ_INSURANCE_ADJUSTER', 'UPDATE_INSURANCE_ADJUSTER', 'DELETE_INSURANCE_ADJUSTER', 'RESTORE_INSURANCE_ADJUSTER']);
        $technicalServicesRole->givePermissionTo(['CREATE_TECHNICAL_SERVICES', 'READ_TECHNICAL_SERVICES', 'UPDATE_TECHNICAL_SERVICES', 'DELETE_TECHNICAL_SERVICES', 'RESTORE_TECHNICAL_SERVICES']);
        $marketingRole->givePermissionTo(['CREATE_MARKETING', 'READ_MARKETING', 'UPDATE_MARKETING', 'DELETE_MARKETING', 'RESTORE_MARKETING']);
        $warehouseRole->givePermissionTo(['CREATE_WAREHOUSE', 'READ_WAREHOUSE', 'UPDATE_WAREHOUSE', 'DELETE_WAREHOUSE', 'RESTORE_WAREHOUSE']);
        $administrativeRole->givePermissionTo(['CREATE_ADMINISTRATIVE', 'READ_ADMINISTRATIVE', 'UPDATE_ADMINISTRATIVE', 'DELETE_ADMINISTRATIVE', 'RESTORE_ADMINISTRATIVE']);
        $collectionsRole->givePermissionTo(['CREATE_COLLECTIONS', 'READ_COLLECTIONS', 'UPDATE_COLLECTIONS', 'DELETE_COLLECTIONS', 'RESTORE_COLLECTIONS']);
        $reportesRole->givePermissionTo(['CREATE_REPORTES', 'READ_REPORTES', 'UPDATE_REPORTES', 'DELETE_REPORTES', 'RESTORE_REPORTES']);
        $leadRole->givePermissionTo(['CREATE_LEAD', 'READ_LEAD', 'UPDATE_LEAD', 'DELETE_LEAD', 'RESTORE_LEAD']);
        $employeesRole->givePermissionTo(['CREATE_EMPLOYEES', 'READ_EMPLOYEES', 'UPDATE_EMPLOYEES', 'DELETE_EMPLOYEES', 'RESTORE_EMPLOYEES']);
        $clientRole->givePermissionTo(['CREATE_CLIENT', 'READ_CLIENT', 'UPDATE_CLIENT', 'DELETE_CLIENT', 'RESTORE_CLIENT']);
        $contactRole->givePermissionTo(['CREATE_CONTACT', 'READ_CONTACT', 'UPDATE_CONTACT', 'DELETE_CONTACT', 'RESTORE_CONTACT']);
        $spectatorRole->givePermissionTo(['CREATE_SPECTATOR', 'READ_SPECTATOR', 'UPDATE_SPECTATOR', 'DELETE_SPECTATOR', 'RESTORE_SPECTATOR']);

        // ============================================
        // USERS CREATION SECTION
        // ============================================

        // SUPER ADMIN USER - Full access
        $superAdminUser = User::factory()->create([
            'name' => 'Victor',
            'last_name' => 'Lara',
            'email' => 'info@aquashieldrestorationusa.com',
            'username' => 'aquashieldrestorationusa',
            'password' => bcrypt('info01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $superAdminUser->assignRole('SUPER_ADMIN');
        // END SUPER ADMIN USER

        // SECOND SUPER ADMIN USER - Full access
        $superAdminUser2 = User::factory()->create([
            'name' => 'Argenis',
            'last_name' => 'Gonzalez',
            'email' => 'argenis692@gmail.com',
            'username' => 'argenis692',
            'password' => bcrypt('argenis01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $superAdminUser2->assignRole('SUPER_ADMIN');
        // END SECOND SUPER ADMIN USER

        // ADMIN USER - Appointments and Call Records
        $adminUser = User::factory()->create([
            'name' => 'Admin',
            'last_name' => 'User',
            'email' => 'admin@aquashieldrestorationusa.com',
            'username' => 'adminAppointment',
            'password' => bcrypt('admin01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $adminUser->assignRole('ADMIN');
        // END ADMIN USER

        // MANAGER USER - Invoice Demo and Manager permissions
        $managerUser = User::factory()->create([
            'name' => 'Manager',
            'last_name' => 'User',
            'email' => 'manager@aquashieldrestorationusa.com',
            'username' => 'manager01',
            'password' => bcrypt('manager01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $managerUser->assignRole('MANAGER');
        // END MANAGER USER

        // USER - Call Records only
        $userUser = User::factory()->create([
            'name' => 'Regular',
            'last_name' => 'User',
            'email' => 'user@user.com',
            'username' => 'user01',
            'password' => bcrypt('user01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $userUser->assignRole('USER');
        // END USER

        // MARKETING MANAGER USER - Marketing Manager permissions
        $marketingManagerUser = User::factory()->create([
            'name' => 'Marketing',
            'last_name' => 'Manager',
            'email' => 'marketingmanager@aquashieldrestorationusa.com',
            'username' => 'marketingmanager01',
            'password' => bcrypt('marketingmanager01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $marketingManagerUser->assignRole('MARKETING_MANAGER');
        // END MARKETING MANAGER USER

        // DIRECTOR ASSISTANT USER - Director Assistant permissions
        $directorAssistantUser = User::factory()->create([
            'name' => 'Director',
            'last_name' => 'Assistant',
            'email' => 'directorassistant@aquashieldrestorationusa.com',
            'username' => 'directorassistant01',
            'password' => bcrypt('directorassistant01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $directorAssistantUser->assignRole('DIRECTOR_ASSISTANT');
        // END DIRECTOR ASSISTANT USER

        // TECHNICAL SUPERVISOR USER - Technical Supervisor permissions
        $technicalSupervisorUser = User::factory()->create([
            'name' => 'Technical',
            'last_name' => 'Supervisor',
            'email' => 'technicalsupervisor@aquashieldrestorationusa.com',
            'username' => 'technicalsupervisor01',
            'password' => bcrypt('technicalsupervisor01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $technicalSupervisorUser->assignRole('TECHNICAL_SUPERVISOR');
        // END TECHNICAL SUPERVISOR USER

        // REPRESENTATION COMPANY USER - Representation Company permissions
        $representationCompanyUser = User::factory()->create([
            'name' => 'Representation',
            'last_name' => 'Company',
            'email' => 'representationcompany@aquashieldrestorationusa.com',
            'username' => 'representationcompany01',
            'password' => bcrypt('representationcompany01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $representationCompanyUser->assignRole('REPRESENTATION_COMPANY');
        // END REPRESENTATION COMPANY USER

        // PUBLIC COMPANY USER - Public Company permissions
        $publicCompanyUser = User::factory()->create([
            'name' => 'Public',
            'last_name' => 'Company',
            'email' => 'publiccompany@aquashieldrestorationusa.com',
            'username' => 'publiccompany01',
            'password' => bcrypt('publiccompany01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $publicCompanyUser->assignRole('PUBLIC_COMPANY');
        // END PUBLIC COMPANY USER

        // EXTERNAL OPERATORS USER - External Operators permissions
        $externalOperatorsUser = User::factory()->create([
            'name' => 'External',
            'last_name' => 'Operators',
            'email' => 'externaloperators@aquashieldrestorationusa.com',
            'username' => 'externaloperators01',
            'password' => bcrypt('externaloperators01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $externalOperatorsUser->assignRole('EXTERNAL_OPERATORS');
        // END EXTERNAL OPERATORS USER

        // PUBLIC ADJUSTER USER - Public Adjuster permissions
        $publicAdjusterUser = User::factory()->create([
            'name' => 'Public',
            'last_name' => 'Adjuster',
            'email' => 'publicadjuster@aquashieldrestorationusa.com',
            'username' => 'publicadjuster01',
            'password' => bcrypt('publicadjuster01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $publicAdjusterUser->assignRole('PUBLIC_ADJUSTER');
        // END PUBLIC ADJUSTER USER

        // INSURANCE ADJUSTER USER - Insurance Adjuster permissions
        $insuranceAdjusterUser = User::factory()->create([
            'name' => 'Insurance',
            'last_name' => 'Adjuster',
            'email' => 'insuranceadjuster@aquashieldrestorationusa.com',
            'username' => 'insuranceadjuster01',
            'password' => bcrypt('insuranceadjuster01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $insuranceAdjusterUser->assignRole('INSURANCE_ADJUSTER');
        // END INSURANCE ADJUSTER USER

        // TECHNICAL SERVICES USER - Technical Services permissions
        $technicalServicesUser = User::factory()->create([
            'name' => 'Technical',
            'last_name' => 'Services',
            'email' => 'technicalservices@aquashieldrestorationusa.com',
            'username' => 'technicalservices01',
            'password' => bcrypt('technicalservices01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $technicalServicesUser->assignRole('TECHNICAL_SERVICES');
        // END TECHNICAL SERVICES USER

        // MARKETING USER - Marketing permissions
        $marketingUser = User::factory()->create([
            'name' => 'Marketing',
            'last_name' => 'User',
            'email' => 'marketing@aquashieldrestorationusa.com',
            'username' => 'marketing01',
            'password' => bcrypt('marketing01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $marketingUser->assignRole('MARKETING');
        // END MARKETING USER

        // WAREHOUSE USER - Warehouse permissions
        $warehouseUser = User::factory()->create([
            'name' => 'Warehouse',
            'last_name' => 'User',
            'email' => 'warehouse@aquashieldrestorationusa.com',
            'username' => 'warehouse01',
            'password' => bcrypt('warehouse01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $warehouseUser->assignRole('WAREHOUSE');
        // END WAREHOUSE USER

        // ADMINISTRATIVE USER - Administrative permissions
        $administrativeUser = User::factory()->create([
            'name' => 'Administrative',
            'last_name' => 'User',
            'email' => 'administrative@aquashieldrestorationusa.com',
            'username' => 'administrative01',
            'password' => bcrypt('administrative01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $administrativeUser->assignRole('ADMINISTRATIVE');
        // END ADMINISTRATIVE USER

        // COLLECTIONS USER - Collections permissions
        $collectionsUser = User::factory()->create([
            'name' => 'Collections',
            'last_name' => 'User',
            'email' => 'collections@aquashieldrestorationusa.com',
            'username' => 'collections01',
            'password' => bcrypt('collections01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $collectionsUser->assignRole('COLLECTIONS');
        // END COLLECTIONS USER

        // REPORTES USER - Reportes permissions
        $reportesUser = User::factory()->create([
            'name' => 'Reportes',
            'last_name' => 'User',
            'email' => 'reportes@aquashieldrestorationusa.com',
            'username' => 'reportes01',
            'password' => bcrypt('reportes01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $reportesUser->assignRole('REPORTES');
        // END REPORTES USER

        // SALESPERSON USER - Salesperson permissions
        $salespersonUser = User::factory()->create([
            'name' => 'Sales',
            'last_name' => 'Person',
            'email' => 'salesperson@aquashieldrestorationusa.com',
            'username' => 'salesperson01',
            'password' => bcrypt('salesperson01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $salespersonUser->assignRole('SALESPERSON');
        // END SALESPERSON USER

        // LEAD USER - Lead permissions
        $leadUser = User::factory()->create([
            'name' => 'Lead',
            'last_name' => 'User',
            'email' => 'lead@aquashieldrestorationusa.com',
            'username' => 'lead01',
            'password' => bcrypt('lead01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $leadUser->assignRole('LEAD');
        // END LEAD USER

        // EMPLOYEES USER - Employees permissions
        $employeesUser = User::factory()->create([
            'name' => 'Employee',
            'last_name' => 'User',
            'email' => 'employees@aquashieldrestorationusa.com',
            'username' => 'employees01',
            'password' => bcrypt('employees01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $employeesUser->assignRole('EMPLOYEES');
        // END EMPLOYEES USER

        // CLIENT USER - Client permissions
        $clientUser = User::factory()->create([
            'name' => 'Client',
            'last_name' => 'User',
            'email' => 'client@aquashieldrestorationusa.com',
            'username' => 'client01',
            'password' => bcrypt('client01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $clientUser->assignRole('CLIENT');
        // END CLIENT USER

        // CONTACT USER - Contact permissions
        $contactUser = User::factory()->create([
            'name' => 'Contact',
            'last_name' => 'User',
            'email' => 'contact@aquashieldrestorationusa.com',
            'username' => 'contact01',
            'password' => bcrypt('contact01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $contactUser->assignRole('CONTACT');
        // END CONTACT USER

        // SPECTATOR USER - Spectator permissions
        $spectatorUser = User::factory()->create([
            'name' => 'Spectator',
            'last_name' => 'User',
            'email' => 'spectator@aquashieldrestorationusa.com',
            'username' => 'spectator01',
            'password' => bcrypt('spectator01='),
            'uuid' => Uuid::uuid4()->toString(),
            'terms_and_conditions' => true
        ]);
        $spectatorUser->assignRole('SPECTATOR');
        // END SPECTATOR USER
    }
}