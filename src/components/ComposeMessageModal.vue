<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { useStore } from '../store'

const emit = defineEmits(['close'])
const store = useStore()

const text = ref('')
const status = ref('')
const busy = ref(false)
const adminExists = ref(false)

async function send() {
  if (!text.value.trim()) return
  busy.value = true
  status.value = ''
  try {
    const { data: admins, error: aErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
    if (aErr) throw aErr
    if (!admins?.length) throw new Error('Нет администраторов')

    const { error } = await supabase.from('messages').insert({
      user_id: store.currentUser.id,
      admin_id: admins[0].id,
      text: text.value.trim(),
      status: 'new'
    })
    if (error) throw error

    status.value = '✅ Отправлено'
    setTimeout(() => emit('close'), 1000)
  } catch (e) {
    status.value = '❌ ' + (e.message || e)
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
  adminExists.value = !!data?.length
})
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <h3>Написать админу</h3>
      <textarea
        v-model="text"
        placeholder="Например: добавьте, пожалуйста, сериал «Тьма»..."
        rows="5"
      ></textarea>
      <p v-if="!adminExists" class="warn">⚠️ Пока нет ни одного администратора</p>
      <p v-if="status" class="status">{{ status }}</p>
      <div class="actions">
        <button class="btn" @click="emit('close')">Отмена</button>
        <button
          class="btn btn-primary"
          :disabled="busy || !text.trim() || !adminExists"
          @click="send"
        >
          {{ busy ? '...' : 'Отправить' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;
  justify-content:center;z-index:400;padding:20px;}
.modal{background:var(--bg-modal);border:1px solid var(--border);border-radius:var(--radius);
  padding:24px;width:100%;max-width:480px;}
.modal h3{margin-bottom:14px;}
textarea{width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border);
  background:var(--bg-body);color:var(--text-primary);font-family:inherit;font-size:.9rem;resize:vertical;}
.actions{display:flex;gap:10px;margin-top:14px;}
.actions .btn{flex:1;}
.btn{display:inline-flex;padding:9px 16px;border-radius:24px;border:1px solid var(--border);
  background:var(--bg-card);color:var(--text-primary);cursor:pointer;font-family:inherit;justify-content:center;}
.btn-primary{background:var(--status-watching);border-color:var(--status-watching);color:#fff;}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.status{font-size:.85rem;margin-top:10px;color:var(--status-watched);}
.warn{font-size:.82rem;margin-top:8px;color:var(--status-wont-watch);}
</style>