<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table): void {
            $table->id();
            $table->string('uuid')->unique();
            $table->string('post_title');
            $table->string('post_title_slug')->unique();
            $table->longText('post_content');
            $table->string('post_excerpt', 500)->nullable();
            $table->string('post_cover_image')->nullable();
            $table->string('meta_title')->nullable();
            $table->string('meta_description', 500)->nullable();
            $table->string('meta_keywords')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('blog_categories')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('post_status')->default('draft');
            
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['post_status', 'created_at']);
            $table->index(['category_id', 'created_at']);
            $table->index(['deleted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
