import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let createdBusinessId: string | null = null;
  let createdServiceId: number | null = null;
  let createdResourceId: string | null = null;

  try {

    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Get user from auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const formData = await req.formData();
    
    console.log('Processing futsal listing submission for user:', user.id);

    // Parse form data
    const businessName = formData.get('businessName') as string;
    const numberOfFields = parseInt(formData.get('numberOfFields') as string);
    const streetAddress = formData.get('streetAddress') as string;
    const town = formData.get('town') as string;
    const province = formData.get('province') as string;
    const nearestBusStop = formData.get('nearestBusStop') as string;
    const nearestTrainStation = formData.get('nearestTrainStation') as string;
    const googleMapLocation = formData.get('googleMapLocation') as string;
    const facebook = formData.get('facebook') as string;
    const tiktok = formData.get('tiktok') as string;
    const infoWebsite = formData.get('infoWebsite') as string;
    const priceCurrency = formData.get('priceCurrency') as string;
    const posLitePrice = formData.get('posLitePrice') as string;
    const serviceListingPrice = formData.get('serviceListingPrice') as string;
    const posLiteOption = formData.get('posLiteOption') as string;
    const phoneNumber = formData.get('phoneNumber') as string;
    const bookingStartTime = formData.get('bookingStartTime') as string;
    const bookingEndTime = formData.get('bookingEndTime') as string;
    const description = formData.get('description') as string;
    const facilities = formData.get('facilities') as string; // JSON string
    const rules = formData.get('rules') as string; // JSON string
    const popularProducts = formData.get('popularProducts') as string;
    const maxCapacity = parseInt(formData.get('maxCapacity') as string);
    const fieldType = formData.get('fieldType') as string;
    
    // Parse field details
    const fieldDetailsStr = formData.get('fieldDetails') as string;
    const fieldDetails = JSON.parse(fieldDetailsStr);
    
    // Parse operating hours
    const operatingHoursStr = formData.get('operatingHours') as string;
    const operatingHours = JSON.parse(operatingHoursStr);
    
    // Parse payment methods
    const paymentMethodsStr = formData.get('paymentMethods') as string;
    const paymentMethodsData = JSON.parse(paymentMethodsStr);

    const pricingRulesStr = formData.get('pricingRules') as string | null;
    let pricingRules: Array<{
      rule_name: string;
      price_override: number;
      day_of_week: number[] | null;
      start_time: string;
      end_time: string;
    }> = [];

    if (pricingRulesStr) {
      try {
        const parsed = JSON.parse(pricingRulesStr);
        if (Array.isArray(parsed)) {
          pricingRules = parsed
            .filter((rule) =>
              rule &&
              typeof rule.rule_name === 'string' &&
              rule.rule_name.trim().length > 0 &&
              typeof rule.price_override === 'number' &&
              !Number.isNaN(rule.price_override) &&
              typeof rule.start_time === 'string' &&
              typeof rule.end_time === 'string'
            )
            .map((rule) => ({
              rule_name: rule.rule_name.trim(),
              price_override: rule.price_override,
              day_of_week: Array.isArray(rule.day_of_week) && rule.day_of_week.length > 0
                ? rule.day_of_week.map((day: number) => Number(day)).filter((day: number) => Number.isFinite(day))
                : null,
              start_time: rule.start_time.length === 5 ? `${rule.start_time}:00` : rule.start_time,
              end_time: rule.end_time.length === 5 ? `${rule.end_time}:00` : rule.end_time,
            }));
        }
      } catch (pricingParseError) {
        console.error('Failed to parse pricing rules payload:', pricingParseError);
        throw new Error('Invalid pricing rules format');
      }
    }

    // Upload service images
    const imageFiles: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image_') && value instanceof File) {
        imageFiles.push(value);
      }
    }

    const uploadedImageUrls: string[] = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(`services/${fileName}`, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Image upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('business-assets')
        .getPublicUrl(`services/${fileName}`);
      
      uploadedImageUrls.push(publicUrl);
    }

    // Upload receipt
    let receiptUrl = null;
    const receiptFile = formData.get('receiptFile') as File | null;
    if (receiptFile) {
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_receipt.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(`receipts/${fileName}`, receiptFile, {
          contentType: receiptFile.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Receipt upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('business-assets')
        .getPublicUrl(`receipts/${fileName}`);
      
      receiptUrl = publicUrl;
    }

    // Calculate dates
    const today = new Date();
    const serviceListingExpired = new Date(today);
    serviceListingExpired.setDate(serviceListingExpired.getDate() + 365);
    
    let litePosValue = null;
    let litePosExpired = null;
    
    if (posLiteOption === 'accept') {
      litePosValue = 1;
      litePosExpired = new Date(today);
      litePosExpired.setDate(litePosExpired.getDate() + 365);
    }

    // 1. Create business record
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        owner_id: user.id,
        name: businessName,
        address: streetAddress,
        towns: town,
        province_district: province,
        google_map_location: googleMapLocation,
        facebook_page: facebook,
        tiktok_url: tiktok,
        website: infoWebsite,
        nearest_bus_stop: nearestBusStop,
        nearest_train_station: nearestTrainStation,
        price_currency: priceCurrency,
        pos_lite_price: posLitePrice,
        service_listing_price: serviceListingPrice,
        lite_pos: litePosValue,
        lite_pos_expired: litePosExpired?.toISOString().split('T')[0],
        payment_status: 'to_be_confirmed',
        searchable_business: false,
      })
      .select()
      .single();

    if (businessError) {
      console.error('Business creation error:', businessError);
      throw new Error(
        businessError.message || 'Failed to create business record'
      );
    }

    console.log('Business created:', business.id);
    createdBusinessId = business.id;

    // 2. Create services record FIRST to get the service_id
    // Generate unique service_key using business_id
    const uniqueServiceKey = `futsal_booking_${business.id}`;
    
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .insert({
        category_id: '2f12b3d2-35fa-4fda-ba30-6ca0ceab58d7', // Futsal category
        service_key: uniqueServiceKey,
        popular_products: popularProducts,
        services_description: description,
        facilities: facilities,
        rules: rules,
        service_images: uploadedImageUrls,
        contact_phone: phoneNumber,
        contact_available_start: bookingStartTime,
        contact_available_until: bookingEndTime,
        service_listing_receipt: receiptUrl,
        service_listing_expired: serviceListingExpired.toISOString().split('T')[0],
        default_duration_min: 60,
      })
      .select()
      .single();

    if (serviceError) {
      console.error('Service creation error:', serviceError);
      throw new Error(
        serviceError.message || 'Failed to create service record'
      );
    }

    console.log('Service created:', service.id);
    createdServiceId = service.id;

    // Calculate base price (minimum of all slot prices)
    const prices = fieldDetails.map((f: any) => {
      const price = parseFloat(f.price);
      if (isNaN(price) || !isFinite(price)) {
        throw new Error(`Invalid price value: ${f.price}`);
      }
      return price;
    });
    
    if (prices.length === 0) {
      throw new Error('No field details provided');
    }
    
    const basePrice = Math.min(...prices);
    console.log('Calculated base price:', basePrice);

    // 3. Create business_resources record using the service_id from step 2
    const { data: resource, error: resourceError } = await supabase
      .from('business_resources')
      .insert({
        business_id: business.id,
        name: businessName,
        service_id: service.id,
        max_capacity: maxCapacity,
        base_price: basePrice,
        field_type: fieldType,
      })
      .select()
      .single();

    if (resourceError) {
      console.error('Resource creation error:', resourceError);
      throw new Error(
        resourceError.message || 'Failed to create primary resource record'
      );
    }

    console.log('Resource created:', resource.id);
    createdResourceId = resource.id;

    // 4. Create business_schedules for each day (only insert open days)
    const schedulesToInsert = operatingHours
      .map((hour: any, index: number) => {
        // Skip closed days - don't insert records for them
        if (hour.closed) {
          return null;
        }
        
        return {
          resource_id: resource.id,
          day_of_week: index + 1, // 1 = Monday, 7 = Sunday
          is_open: true,
          open_time: hour.openTime,
          close_time: hour.closeTime,
        };
      })
      .filter((schedule: any) => schedule !== null); // Remove null entries for closed days

    // Only insert if there are open days
    if (schedulesToInsert.length > 0) {
      const { error: schedulesError } = await supabase
        .from('business_schedules')
        .insert(schedulesToInsert);

      if (schedulesError) {
        console.error('Schedules creation error:', schedulesError);
        throw new Error(
          schedulesError.message || 'Failed to create operating schedules'
        );
      }

      console.log('Schedules created:', schedulesToInsert.length);
    } else {
      console.log('No open days - skipping schedule creation');
    }

    // 5. Insert pricing rules for the resource before generating slots
    if (pricingRules.length > 0) {
      const pricingRulesToInsert = pricingRules.map((rule) => ({
        resource_id: resource.id,
        rule_name: rule.rule_name,
        price_override: rule.price_override,
        day_of_week: rule.day_of_week && rule.day_of_week.length > 0 ? rule.day_of_week : null,
        start_time: rule.start_time,
        end_time: rule.end_time,
      }));

      const { error: pricingRulesError } = await supabase
        .from('resource_pricing_rules')
        .insert(pricingRulesToInsert);

      if (pricingRulesError) {
        console.error('Pricing rules creation error:', pricingRulesError);
        throw new Error(
          pricingRulesError.message || 'Failed to persist pricing rules'
        );
      }

      console.log('Pricing rules inserted:', pricingRulesToInsert.length);
    } else {
      console.log('No pricing rules provided - skipping pricing rule insertion');
    }

    // 6. Create payment_methods records
    const paymentMethodsToInsert: any[] = [];
    
    if (paymentMethodsData.cash) {
      paymentMethodsToInsert.push({
        business_id: business.id,
        method_type: 'Cash on Arrival',
        account_name: null,
        account_number: null,
      });
    }
    
    if (paymentMethodsData.kpay) {
      paymentMethodsToInsert.push({
        business_id: business.id,
        method_type: 'KBZ Pay',
        account_name: paymentMethodsData.kpayName,
        account_number: paymentMethodsData.kpayPhone,
      });
    }

    if (paymentMethodsData.paylah) {
      paymentMethodsToInsert.push({
        business_id: business.id,
        method_type: 'PayLah!',
        account_name: paymentMethodsData.paylahName,
        account_number: paymentMethodsData.paylahPhone,
      });
    }

    if (paymentMethodsData.truemoney) {
      paymentMethodsToInsert.push({
        business_id: business.id,
        method_type: 'True Money',
        account_name: paymentMethodsData.truemoneyName,
        account_number: paymentMethodsData.truemoneyPhone,
      });
    }

    if (paymentMethodsData.grabpay) {
      paymentMethodsToInsert.push({
        business_id: business.id,
        method_type: 'GrabPay',
        account_name: paymentMethodsData.grabpayName,
        account_number: paymentMethodsData.grabpayPhone,
      });
    }

    if (paymentMethodsToInsert.length > 0) {
      const { error: paymentError } = await supabase
        .from('payment_methods')
        .insert(paymentMethodsToInsert);

      if (paymentError) {
        console.error('Payment methods creation error:', paymentError);
        throw new Error(
          paymentError.message || 'Failed to create payment methods'
        );
      }

      console.log('Payment methods created:', paymentMethodsToInsert.length);
    }

    // 7. Generate time slots automatically for the next 30 days
    if (schedulesToInsert.length > 0) {
      console.log('Generating time slots for the next 30 days...');
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
      const { data: slotsResult, error: slotsGenError } = await supabase.functions.invoke('generate-slots', {
        body: {
          resourceId: resource.id,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          slotDurationMinutes: 60,
        }
      });

      if (slotsGenError) {
        console.error('Slot generation warning:', slotsGenError);
        // Don't throw - this is not critical for listing creation
      } else {
        console.log('Time slots generated successfully:', slotsResult);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        business_id: business.id,
        resource_id: resource.id,
        service_id: service.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error processing futsal listing:', error);

    // Best-effort cleanup to avoid leaving partial data behind
    try {
      if (createdResourceId) {
        const { error: resourceCleanupError } = await supabase
          .from('business_resources')
          .delete()
          .eq('id', createdResourceId);
        if (resourceCleanupError) {
          console.error('Failed to cleanup business_resource:', resourceCleanupError);
        }
      }

      if (createdServiceId !== null) {
        const { error: serviceCleanupError } = await supabase
          .from('services')
          .delete()
          .eq('id', createdServiceId);
        if (serviceCleanupError) {
          console.error('Failed to cleanup service:', serviceCleanupError);
        }
      }

      if (createdBusinessId) {
        const { error: businessCleanupError } = await supabase
          .from('businesses')
          .delete()
          .eq('id', createdBusinessId);
        if (businessCleanupError) {
          console.error('Failed to cleanup business:', businessCleanupError);
        }
      }
    } catch (cleanupError) {
      console.error('Cleanup routine encountered an error:', cleanupError);
    }

    const message = error instanceof Error
      ? error.message
      : (typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: string }).message)
        : 'Unknown error occurred');

    const details = typeof error === 'object' && error !== null && 'details' in error
      ? (error as { details?: string }).details
      : undefined;

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        details,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
