// js/supabase.js
// Remplacer par vos identifiants Supabase
const supabaseUrl = 'https://odfjplhtqivdntkkuyop.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZmpwbGh0cWl2ZG50a2t1eW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDY4NDgsImV4cCI6MjA5MzkyMjg0OH0.HjJ-MLhPBzcvIvcPU1S0HAEu7tH4KEsAO7MPuc2sk1I';

export const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
