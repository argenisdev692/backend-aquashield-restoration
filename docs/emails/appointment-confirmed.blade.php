<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>✅ ¡Cita Confirmada! - V General Contractors</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
        }

        .logo {
            text-align: center;
            margin-bottom: 25px;
        }

        .logo img {
            max-width: 173px;
            height: auto;
        }

        .details {
            line-height: 1.6;
            color: #333333;
        }

        .footer {
            margin-top: 25px;
            text-align: center;
            color: #666666;
            font-size: 14px;
        }

        .social-icons {
            margin-top: 5px;
            margin-bottom: 20px;
            text-align: center;
        }

        .social-icons a {
            margin: 0 10px;
            display: inline-block;
        }

        .highlight-green {
            color: #10b981;
            font-weight: bold;
        }

        .confirmation-banner {
            background: #e6f9e9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }

        .appointment-details {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }

        .details td {
            padding: 8px 0;
            vertical-align: top;
        }

        .details strong {
            display: inline-block;
            width: 150px;
            color: #4a5568;
        }

        .status-tag {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            background-color: #10b981;
            color: white;
        }

        .action-button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #10b981;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 15px 0;
        }
    </style>
</head>

<body>
    @php
        // Función para formatear números de teléfono españoles
        if (!function_exists('formatSpanishPhone')) {
            function formatSpanishPhone($phoneNumber)
            {
                // Eliminar cualquier espacio existente
                $cleaned = preg_replace('/\s+/', '', $phoneNumber);

                // Si el número comienza con +34, formatearlo correctamente
                if (str_starts_with($cleaned, '+34')) {
                    // Quitar el código de país para trabajar solo con los 9 dígitos
                    $nationalNumber = substr($cleaned, 3);

                    // Aplicar formato +34 XXX XX XX XX
                    if (strlen($nationalNumber) === 9) {
                        return '+34 ' .
                            substr($nationalNumber, 0, 3) .
                            ' ' .
                            substr($nationalNumber, 3, 2) .
                            ' ' .
                            substr($nationalNumber, 5, 2) .
                            ' ' .
                            substr($nationalNumber, 7, 2);
                    }
                }

                // Si no es un número español o no tiene el formato esperado, devolverlo sin cambios
                return $phoneNumber;
            }
        }

        // Obtener los datos de correo del administrador
        $adminEmail = \App\Models\EmailData::where('type', 'Admin')->first();
        $adminEmailAddress = $adminEmail ? $adminEmail->email : $companyData->email;
        $adminPhone = $adminEmail ? $adminEmail->phone : $companyData->phone;
    @endphp

    <div class="container">
        <!-- Logo -->
        <div class="logo">
            <img src="https://vgeneralcontractors.com/assets/logo/logo-png.png" width="173"
                alt="Logo V General Contractors">
        </div>

        <div class="details">
            <h2 style="color: #10b981; text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
                ✅ ¡Su cita ha sido confirmada!
            </h2>

            <div class="confirmation-banner">
                <p style="text-align: center; margin: 0;">
                    <strong>Hemos confirmado su cita exitosamente.</strong>
                </p>
            </div>

            <p style="margin: 20px 0;">Hola <strong>{{ $appointment->first_name }}
                    {{ $appointment->last_name }}</strong>,</p>

            <p>Nos complace confirmar su cita con <strong>{{ $companyData->company_name }}</strong>.
                Hemos recibido y aprobado su solicitud, ¡estamos esperando para atenderle!</p>

            <div class="appointment-details">
                <h3 style="color: #2d3748; margin-top: 0;">Detalles de la Cita:</h3>
                <table style="width: 100%;">
                    @if ($appointment->service)
                        <tr>
                            <td><strong>Servicio:</strong></td>
                            <td>{{ $appointment->service->name }}</td>
                        </tr>
                    @endif
                    <tr>
                        <td><strong>Estado:</strong></td>
                        <td><span class="status-tag">Confirmada</span></td>
                    </tr>
                    <tr>
                        <td><strong>Fecha y hora:</strong></td>
                        <td>
                            @php
                                $inspectionDate = \Carbon\Carbon::parse($appointment->inspection_date);
                                $inspectionTime = \Carbon\Carbon::parse($appointment->inspection_time);
                                $startDateTime = $inspectionDate->setTimeFrom($inspectionTime);
                                $endDateTime = $startDateTime->copy()->addHours(3);
                                $formattedDate = $startDateTime
                                    ->locale('es')
                                    ->isoFormat('dddd D [de] MMMM [de] YYYY [a las] hh:mm A');
                                echo ucfirst($formattedDate);
                            @endphp
                            <br>
                            <small>Duración: 2 horas (hasta {{ $endDateTime->format('h:i A') }})</small>
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Duración:</strong></td>
                        <td>2 horas</td>
                    </tr>
                    <tr>
                        <td><strong>Dirección:</strong></td>
                        <td>
                            {{ $appointment->address }}
                            @if ($appointment->address_2)
                                <br>{{ $appointment->address_2 }}
                            @endif
                            <br>{{ $appointment->city }}, {{ $appointment->state }} {{ $appointment->zipcode }}
                            <br>{{ $appointment->country }}
                        </td>
                    </tr>


                    @if (!empty($appointment->notes))
                        <tr>
                            <td><strong>Notas:</strong></td>
                            <td>{{ $appointment->notes }}</td>
                        </tr>
                    @endif
                </table>
            </div>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #2d3748;">¿Qué debe hacer ahora?</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Guarde esta información en su calendario</li>
                    <li>Si necesita reprogramar o cancelar, contáctenos lo antes posible</li>
                    <li>Por favor, tenga a mano su <span style="color: #252424; font-weight: bold;">póliza de cobertura
                            de seguro</span> de su propiedad el día
                        de la inspección</li>
                </ul>
            </div>

            <p>Si tiene alguna pregunta o necesita asistencia adicional, no dude en contactarnos.</p>

            <div
                style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; border: 1px solid #e9ecef; margin: 20px 0;">
                @php
                    $phoneToDisplay = '';
                    if ($adminPhone) {
                        $digitsOnly = preg_replace('/[^0-9]/', '', $adminPhone);
                        if (strlen($digitsOnly) == 10) {
                            $phoneToDisplay =
                                '(' .
                                substr($digitsOnly, 0, 3) .
                                ') ' .
                                substr($digitsOnly, 3, 3) .
                                '-' .
                                substr($digitsOnly, 6);
                        } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                            $phoneToDisplay =
                                '(' .
                                substr($digitsOnly, 1, 3) .
                                ') ' .
                                substr($digitsOnly, 4, 3) .
                                '-' .
                                substr($digitsOnly, 7);
                        } else {
                            $phoneToDisplay = $adminPhone;
                        }
                    }
                @endphp

                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td align="center" style="padding-bottom: 10px;">
                            <span style="font-size: 16px; color: #4a5568;"><strong>Contáctenos</strong></span>
                        </td>
                    </tr>
                    <tr>
                        <td align="center">
                            <table cellpadding="0" cellspacing="0" border="0">
                                @if ($adminPhone)
                                    <tr>
                                        <td align="center" style="padding-bottom: 8px;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td
                                                        style="font-size: 14px; color: #4a5568; vertical-align: middle;">
                                                        📞</td>
                                                    <td style="padding-left: 5px; vertical-align: middle;">
                                                        <a href="tel:{{ preg_replace('/[^0-9]/', '', $adminPhone) }}"
                                                            style="text-decoration: none; color: #10b981; font-weight: bold;">{{ $phoneToDisplay }}</a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                @endif

                                @if ($adminEmailAddress)
                                    <tr>
                                        <td align="center">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td
                                                        style="font-size: 18px; color: #4a5568; vertical-align: middle;">
                                                        📧</td>
                                                    <td style="padding-left: 10px; vertical-align: middle;">
                                                        <a href="mailto:{{ $adminEmailAddress }}"
                                                            style="text-decoration: none; color: #10b981; font-weight: bold;">{{ $adminEmailAddress }}</a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                @endif
                            </table>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Redes Sociales -->
        <div class="social-icons" style="margin-top: 30px;">
            @if ($companyData->facebook_link)
                <a href="{{ $companyData->facebook_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="30" alt="Facebook">
                </a>
            @endif
            @if ($companyData->instagram_link)
                <a href="{{ $companyData->instagram_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="30" alt="Instagram">
                </a>
            @endif
            @if ($companyData->linkedin_link)
                <a href="{{ $companyData->linkedin_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" width="30" alt="LinkedIn">
                </a>
            @endif
            @if ($companyData->twitter_link)
                <a href="{{ $companyData->twitter_link }}" target="_blank">
                    <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="30" alt="Twitter">
                </a>
            @endif
        </div>

        <!-- Pie de Página -->
        <div class="footer">
            <p>Horario de atención:<br>
                {{ $companyData->business_hours ?? 'Lunes a Viernes: 9:00 AM - 5:00 PM' }}</p>
            <p style="margin-top: 10px; font-size: 12px;">© {{ date('Y') }} {{ $companyData->company_name }}.
                Todos los derechos reservados.</p>

            <div style="margin-top: 15px; font-size: 12px; color: #777;">
                @if ($companyData->address || $companyData->phone || $companyData->email)
                    @if ($companyData->address)
                        <p style="margin: 3px 0;">{{ $companyData->address }}</p>
                    @endif

                    <p style="margin: 3px 0;">
                        @if ($companyData->phone)
                            <span>
                                @php
                                    $phone = $companyData->phone ?? '';
                                    $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
                                    if (strlen($digitsOnly) == 10) {
                                        $formattedPhone =
                                            '(' .
                                            substr($digitsOnly, 0, 3) .
                                            ') ' .
                                            substr($digitsOnly, 3, 3) .
                                            '-' .
                                            substr($digitsOnly, 6);
                                    } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                                        $formattedPhone =
                                            '(' .
                                            substr($digitsOnly, 1, 3) .
                                            ') ' .
                                            substr($digitsOnly, 4, 3) .
                                            '-' .
                                            substr($digitsOnly, 7);
                                    } else {
                                        $formattedPhone = $phone;
                                    }
                                @endphp
                                <a href="tel:{{ preg_replace('/[^0-9]/', '', $phone) }}"
                                    style="color: #666; text-decoration: none;">{{ $formattedPhone }}</a>
                            </span>

                            @if ($companyData->email)
                                <span style="margin: 0 5px;">|</span>
                            @endif
                        @endif

                        @if ($companyData->email)
                            <a href="mailto:{{ $companyData->email }}"
                                style="color: #666; text-decoration: none;">{{ $companyData->email }}</a>
                        @endif
                    </p>
                @endif
            </div>
        </div>
    </div>
</body>

</html>
