import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uhykazldqflnnxxmccup.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoeWthemxkcWZsbm54eG1jY3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODc4ODgsImV4cCI6MjA4ODY2Mzg4OH0.TO2sVH9x12kByYn2S2NHyaDd4l26zS9hVdhKnuPHNdg'

export const supabase = createClient(supabaseUrl, supabaseKey)