<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Blog\Infrastructure\Persistence\Eloquent\Models\BlogCategoryEloquentModel;
use Ramsey\Uuid\Uuid;

final class BlogCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $blogCategories = [
            [
                'blog_category_name' => 'AI',
                'blog_category_description' => 'Artificial Intelligence trends, tools and insights',
                'blog_category_image' => null,
                'user_id' => 1,
            ],
            [
                'blog_category_name' => 'Software',
                'blog_category_description' => 'Software development, engineering and best practices',
                'blog_category_image' => null,
                'user_id' => 1,
            ],
            [
                'blog_category_name' => 'Marketing Online',
                'blog_category_description' => 'Digital marketing strategies, SEO and content marketing',
                'blog_category_image' => null,
                'user_id' => 1,
            ],
            [
                'blog_category_name' => 'Social Network',
                'blog_category_description' => 'Social media platforms, networking and community building',
                'blog_category_image' => null,
                'user_id' => 1,
            ],
        ];

        foreach ($blogCategories as $category) {
            BlogCategoryEloquentModel::query()->updateOrCreate(
                ['blog_category_name' => $category['blog_category_name']],
                [
                    'uuid' => Uuid::uuid4()->toString(),
                    'blog_category_description' => $category['blog_category_description'],
                    'blog_category_image' => $category['blog_category_image'],
                    'user_id' => $category['user_id'],
                ],
            );
        }
    }
}