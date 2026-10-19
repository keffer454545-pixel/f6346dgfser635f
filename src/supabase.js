import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://krzoprbbtvnmrocpanbi.supabase.co' // из шага 1
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtyem9wcmJidHZubXJvY3BhbmJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MDcyNjUsImV4cCI6MjEwNzk4MzI2NX0.gzvLvqbOsfFxeJD5q3Xy4UEbcpC5wLXDc-EAMQzxTjs'     // из шага 1

export const supabase = createClient(supabaseUrl, supabaseKey)