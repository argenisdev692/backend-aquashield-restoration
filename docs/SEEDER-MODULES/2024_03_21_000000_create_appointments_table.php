<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('phone');
            $table->string('email')->nullable();
            $table->string('address');
            $table->string('address_2')->nullable();
            $table->string('city');
            $table->string('state');
            $table->string('zipcode');
            $table->string('country');
            $table->boolean('insurance_property')->default(false);
            $table->text('message')->nullable();
            $table->boolean('sms_consent')->default(false);
            $table->timestamp('registration_date')->nullable();
            $table->date('inspection_date')->nullable();
            $table->time('inspection_time')->nullable();
            $table->enum('inspection_status', ['Confirmed', 'Completed', 'Pending', 'Declined'])->nullable();
            $table->enum('status_lead', ['New', 'Called', 'Pending', 'Declined'])->nullable();
            $table->enum('lead_source', ['Website', 'Facebook Ads', 'Reference', 'Retell AI'])->nullable();
            $table->json('follow_up_calls')->nullable()->comment('JSON array storing follow-up call attempts and details');
            $table->text('notes')->nullable();
            $table->string('owner')->nullable();
            $table->text('damage_detail')->nullable();
            $table->boolean('intent_to_claim')->nullable();

            $table->date('follow_up_date')->nullable();
            $table->text('additional_note')->nullable();
            // Add latitude and longitude
            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down()
    {
        Schema::dropIfExists('appointments');
    }
};