<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\BlogCategory;
use Ramsey\Uuid\Uuid;

class BlogCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $blogCategories = [
            [
                'blog_category_name' => 'Roofing',
                'blog_category_description' => 'Valor por defecto',
                'blog_category_image' => 'Valor por defecto',
                'user_id' => 1,
            ],
            [
                'blog_category_name' => 'Water Mitigation',
                'blog_category_description' => 'Categoría para contenido relacionado con mitigación de agua',
                'blog_category_image' => 'Valor por defecto',
                'user_id' => 1,
            ],
        ];

        foreach ($blogCategories as $category) {
            BlogCategory::create([
                'uuid' => Uuid::uuid4()->toString(),
                'blog_category_name' => $category['blog_category_name'],
                'blog_category_description' => $category['blog_category_description'],
                'blog_category_image' => $category['blog_category_image'],
                'user_id' => $category['user_id'],
            ]);
        }
    }
} 