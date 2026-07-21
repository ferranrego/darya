-- Allow users to delete their own messages from the chat

create policy "chat_messages delete own" on public.chat_messages
  for delete to authenticated
  using (user_id = auth.uid());
