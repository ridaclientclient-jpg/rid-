import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ─── GET: Listar contactos de emergencia del usuario ──────────────────────────
export async function GET(request: Request) {
  try {
    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: contacts, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contacts: contacts || [],
      count: contacts?.length ?? 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener contactos de emergencia';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST: Agregar nuevo contacto de emergencia ──────────────────────────────
export async function POST(request: Request) {
  try {
    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, relation } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'El nombre del contacto es requerido' },
        { status: 400 }
      );
    }

    if (!phone || !phone.trim()) {
      return NextResponse.json(
        { error: 'El número de teléfono es requerido' },
        { status: 400 }
      );
    }

    // Enforce max 5 contacts per user
    const { data: existingContacts, error: countError } = await supabase
      .from('emergency_contacts')
      .select('id')
      .eq('user_id', user.id);

    if (countError) throw countError;

    if (existingContacts && existingContacts.length >= 5) {
      return NextResponse.json(
        { error: 'No puedes tener más de 5 contactos de emergencia. Elimina uno existente primero.' },
        { status: 400 }
      );
    }

    // Determine if this contact should be primary
    const isFirstContact = !existingContacts || existingContacts.length === 0;
    const isPrimaryRequested = relation?.toLowerCase() === 'primary';
    const shouldSetPrimary = isFirstContact || isPrimaryRequested;

    // If setting a new primary, unset any existing primary first
    if (shouldSetPrimary) {
      await supabase
        .from('emergency_contacts')
        .update({ is_primary: false })
        .eq('user_id', user.id)
        .eq('is_primary', true);
    }

    // Insert the new contact
    const { data: contact, error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: user.id,
        name: name.trim(),
        phone: phone.trim(),
        relation: relation?.trim() || null,
        is_primary: shouldSetPrimary,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        contact,
        message: shouldSetPrimary
          ? 'Contacto de emergencia agregado como principal'
          : 'Contacto de emergencia agregado exitosamente',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al agregar contacto de emergencia';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── PUT: Actualizar contacto de emergencia ──────────────────────────────────
export async function PUT(request: Request) {
  try {
    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { contact_id, name, phone, relation, is_primary } = body;

    if (!contact_id) {
      return NextResponse.json(
        { error: 'El ID del contacto es requerido' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingContact, error: fetchError } = await supabase
      .from('emergency_contacts')
      .select('id, user_id')
      .eq('id', contact_id)
      .single();

    if (fetchError || !existingContact) {
      return NextResponse.json(
        { error: 'Contacto de emergencia no encontrado' },
        { status: 404 }
      );
    }

    if (existingContact.user_id !== user.id) {
      return NextResponse.json(
        { error: 'No puedes modificar un contacto que no te pertenece' },
        { status: 403 }
      );
    }

    // If promoting to primary, demote existing primary
    if (is_primary === true) {
      await supabase
        .from('emergency_contacts')
        .update({ is_primary: false })
        .eq('user_id', user.id)
        .eq('is_primary', true);
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name.trim();
    if (phone !== undefined) updatePayload.phone = phone.trim();
    if (relation !== undefined) updatePayload.relation = relation.trim() || null;
    if (is_primary !== undefined) updatePayload.is_primary = is_primary;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      );
    }

    const { data: updatedContact, error } = await supabase
      .from('emergency_contacts')
      .update(updatePayload)
      .eq('id', contact_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contact: updatedContact,
      message: 'Contacto de emergencia actualizado exitosamente',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar contacto de emergencia';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── DELETE: Eliminar contacto de emergencia ─────────────────────────────────
export async function DELETE(request: Request) {
  try {
    // Auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { contact_id } = body;

    if (!contact_id) {
      return NextResponse.json(
        { error: 'El ID del contacto es requerido' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: existingContact, error: fetchError } = await supabase
      .from('emergency_contacts')
      .select('id, user_id, is_primary')
      .eq('id', contact_id)
      .single();

    if (fetchError || !existingContact) {
      return NextResponse.json(
        { error: 'Contacto de emergencia no encontrado' },
        { status: 404 }
      );
    }

    if (existingContact.user_id !== user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminar un contacto que no te pertenece' },
        { status: 403 }
      );
    }

    const wasPrimary = existingContact.is_primary;

    // Delete the contact
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', contact_id);

    if (error) throw error;

    // If the deleted contact was primary, promote the oldest remaining contact
    if (wasPrimary) {
      const { data: remainingContacts } = await supabase
        .from('emergency_contacts')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (remainingContacts && remainingContacts.length > 0) {
        await supabase
          .from('emergency_contacts')
          .update({ is_primary: true })
          .eq('id', remainingContacts[0].id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Contacto de emergencia eliminado exitosamente',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al eliminar contacto de emergencia';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
