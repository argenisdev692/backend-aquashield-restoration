<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <title>Notificación Info: Solicitud Rechazada - V General Contractors</title>
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
            max-width: 180px;
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

        .highlight-blue {
            color: #1e90ff;
            font-weight: bold;
        }

        .appointment-banner {
            background: #fff4e6;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #ef4444;
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
            background-color: #dc3545;
            color: white;
        }

        .action-button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #1e90ff;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: bold;
            margin: 15px 0;
        }

        .social-icons {
            margin: 20px 0;
            text-align: center;
        }

        .social-icons a {
            margin: 0 10px;
            display: inline-block;
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- Logo -->
        <div class="logo">
            <img src="https://vgeneralcontractors.com/assets/logo/logo-png.png" width="180"
                alt="Logo V General Contractors">

        </div>

        <div class="details">
            <h2 style="color: #ff9800; text-align: center; border-bottom: 2px solid #ff9800; padding-bottom: 10px;">
                ℹ️ Notificación de Info: Solicitud Rechazada
            </h2>

            <div class="appointment-banner">
                <p style="text-align: center; margin: 0;">
                    <strong>Se ha rechazado una solicitud de inspección en el sistema.</strong>
                </p>
            </div>

            <div class="appointment-details">
                <h3 style="color: #2d3748; margin-top: 0;">Información del Cliente:</h3>
                <table style="width: 100%;">
                    <tr>
                        <td><strong>Nombre:</strong></td>
                        <td>{{ $appointment->first_name }} {{ $appointment->last_name }}</td>
                    </tr>
                    <tr>
                        <td><strong>Email:</strong></td>
                        <td><a href="mailto:{{ $appointment->email }}"
                                style="color: #1e90ff; text-decoration: none; font-weight: 500;">{{ $appointment->email }}</a>
                        </td>
                    </tr>
                    <tr>
                        <td><strong>Teléfono:</strong></td>
                        <td>
                            @php
                                $phone = $appointment->phone ?? '';
                                // Remove any non-digit characters
                                $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
                                // Format the number based on length
                                if (strlen($digitsOnly) == 10) {
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 0, 3) .
                                        ') ' .
                                        substr($digitsOnly, 3, 3) .
                                        '-' .
                                        substr($digitsOnly, 6);
                                } elseif (strlen($digitsOnly) == 11 && substr($digitsOnly, 0, 1) == '1') {
                                    // US number with country code
                                    $formattedPhone =
                                        '(' .
                                        substr($digitsOnly, 1, 3) .
                                        ') ' .
                                        substr($digitsOnly, 4, 3) .
                                        '-' .
                                        substr($digitsOnly, 7);
                                } else {
                                    // Fallback to original
                                    $formattedPhone = $phone;
                                }
                                echo $formattedPhone;
                            @endphp
                        </td>
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
                </table>
            </div>

            <div class="appointment-details">
                <h3 style="color: #2d3748; margin-top: 0;">Detalles del Rechazo:</h3>
                <table style="width: 100%;">
                    <tr>
                        <td><strong>Estado:</strong></td>
                        <td><span class="status-tag">Rechazado</span></td>
                    </tr>
                    <tr>
                        <td><strong>Razones:</strong></td>
                        <td>{{ $reasonsText }}</td>
                    </tr>
                    <tr>
                        <td><strong>Fecha de rechazo:</strong></td>
                        <td>{{ now()->format('d/m/Y H:i:s') }}</td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ url('/appointments/' . $appointment->uuid) }}" class="action-button"
                    style="color: #fff; text-decoration: none;">
                    Ver en el sistema
                </a>
            </div>

            <p style="text-align: center; color: #666; font-size: 14px;">
                Esta es una notificación automática del sistema para el correo Info.
            </p>
        </div>

        <!-- Redes Sociales -->
        @if (isset($companyData))
            <div class="social-icons">
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
                <p>Horario de oficina:<br>
                    Lunes a Viernes: 9:00 AM - 5:00 PM</p>
                <p style="margin-top: 10px; font-size: 12px;">© {{ date('Y') }} {{ $companyData->company_name }}.
                    Todos los derechos reservados.</p>
                @if ($companyData->address)
                    <p style="font-size: 10px; color: #999;">{{ $companyData->address }}</p>
                @endif

                <div style="margin-top: 5px; font-size: 12px; color: #777;">
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
                                    echo $formattedPhone;
                                @endphp
                            </span>

                            @if ($companyData->email)
                                <span style="margin: 0 5px;">|</span>
                            @endif
                        @endif

                        @if ($companyData->email)
                            <a href="mailto:{{ $companyData->email }}"
                                style="color: #1e90ff; text-decoration: none; font-weight: 500;">{{ $companyData->email }}</a>
                        @endif
                    </p>
                </div>
            </div>
        @endif
    </div>
</body>

</html>
